import { prisma } from '../../config/database';
import {
  getCacheService,
  ICacheService,
  CacheKeyBuilder,
} from '../../cache';
import { AiRepository } from './ai.repository';
import { GeminiClient } from './gemini.client';
import { buildSystemPrompt } from './prompt.builder';
import { generarFallback } from './fallback.local';
import {
  detectIntent,
  esPreguntaPrecioEntradaEvento,
  esPreguntaSeguimientoEvento,
} from './ai.intent';
import {
  responderEvento,
  responderEventoNoEncontrado,
  responderPrecioEntradaEvento,
  responderEventosPorPeriodo,
  responderAclaracionRecomendacion,
  responderNegocios,
  responderRecomendacionNegocios,
  responderComoLlegarNegocio,
  responderNegocioParaLlegarNoEncontrado,
} from './catalogo.responses';
import {
  ChatRequest,
  ChatResponse,
  EventoContexto,
  Fuente,
} from './ai.types';

const TTL_GENERAL_MS = 10 * 60 * 1000; // 10 min
const TTL_EVENTO_MS  = 30 * 60 * 1000; // 30 min
const CACHE_KEY_MAX_LEN = 200;

export class AiService {
  private readonly repository: AiRepository;
  private readonly gemini: GeminiClient;
  private readonly cache: ICacheService;
  constructor(
    repository: AiRepository = new AiRepository(),
    gemini?: GeminiClient,
    cache: ICacheService = getCacheService()
  ) {
    this.repository = repository;
    this.gemini = gemini ?? new GeminiClient({
      apiKey: process.env.GEMINI_API_KEY ?? '',
      modelos: [
        process.env.GEMINI_MODEL_PRIMARY   ?? 'gemini-flash-latest',
      ],
      maxOutputTokens: 220,
      temperature: 0.3,
    });
    this.cache = cache;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const { pregunta, idioma, eventoId, negocioSlug, eventoSlug, contextoEventos, ip } = req;

    // 1. Caché: si hay hit, no gastamos cuota ni tocamos la BD
    const cacheKey = this.buildCacheKey(
      pregunta,
      idioma,
      eventoId,
      negocioSlug,
      eventoSlug,
      contextoEventos,
    );
    const cached = this.cache.get<ChatResponse>(cacheKey);
    if (cached) {
      this.guardarLog(pregunta, cached.respuesta, idioma, ip);
      return { ...cached, fuente: 'cache' };
    }

    if (negocioSlug && this.preguntaComoLlegar(pregunta)) {
      const negocio = await this.repository.findNegocioPublicadoPorSlug(negocioSlug);
      const respuesta = negocio
        ? responderComoLlegarNegocio(negocio, idioma)
        : responderNegocioParaLlegarNoEncontrado(idioma);
      return this.guardarRespuesta(cacheKey, pregunta, respuesta, idioma, ip, 'catalogo');
    }

    if (eventoSlug && esPreguntaSeguimientoEvento(pregunta)) {
      const evento = await this.repository.findEventoPublicadoPorSlug(eventoSlug);
      if (!evento) {
        const respuesta = generarFallback({
          eventos: [],
          idioma,
          tipo: 'EVENTO_ESPECIFICO',
          eventoNoEncontrado: true,
        });
        return this.guardarRespuesta(cacheKey, pregunta, respuesta, idioma, ip, 'fallback');
      }

      if (esPreguntaPrecioEntradaEvento(pregunta)) {
        return this.guardarRespuesta(
          cacheKey,
          pregunta,
          responderPrecioEntradaEvento(evento, idioma),
          idioma,
          ip,
          'catalogo',
          TTL_EVENTO_MS,
          evento.id,
        );
      }

      const systemPrompt = buildSystemPrompt({
        eventos: [evento],
        idioma,
        eventoEspecifico: evento,
      });
      const geminiResult = await this.gemini.generate(pregunta, systemPrompt);
      const respuesta = geminiResult?.texto ?? generarFallback({
        eventos: [evento],
        idioma,
        tipo: 'EVENTO_ESPECIFICO',
        eventoEspecifico: evento,
      });
      return this.guardarRespuesta(
        cacheKey,
        pregunta,
        respuesta,
        idioma,
        ip,
        geminiResult ? 'gemini' : 'fallback',
        TTL_EVENTO_MS,
        evento.id,
        geminiResult?.modelo,
      );
    }

    // 2. Pre-filtrado en PostgreSQL según intención
    const intent = detectIntent(pregunta, eventoId);

    if (intent.type === 'EVENTO_BUSQUEDA') {
      const terminosEvento = intent.terminos.length > 0
        ? intent.terminos
        : (intent.periodo || intent.soloFinalizados ? contextoEventos ?? [] : []);
      if (intent.periodo || intent.soloFinalizados) {
        const eventos = intent.periodo
          ? await this.repository.findEventosEnPeriodo(
            intent.periodo,
            terminosEvento,
            intent.soloFinalizados,
          )
          : await this.repository.findFinalizados();
        const respuesta = responderEventosPorPeriodo(
          eventos,
          idioma,
          intent.periodo,
          intent.soloFinalizados,
          terminosEvento,
        );
        return this.guardarRespuesta(
          cacheKey,
          pregunta,
          respuesta,
          idioma,
          ip,
          'catalogo',
          TTL_GENERAL_MS,
          undefined,
          undefined,
          terminosEvento,
        );
      }

      if (terminosEvento.length === 0) {
        const eventos = await this.repository.findProximos();
        const respuesta = generarFallback({ eventos, idioma, tipo: 'GENERAL' });
        return this.guardarRespuesta(cacheKey, pregunta, respuesta, idioma, ip, 'catalogo');
      }

      const eventos = await this.repository.findEventosPorTerminos(terminosEvento);
      const evento = eventos[0];
      const respuesta = evento
        ? responderEvento(evento, idioma)
        : responderEventoNoEncontrado(terminosEvento, idioma);
      return this.guardarRespuesta(
        cacheKey,
        pregunta,
        respuesta,
        idioma,
        ip,
        'catalogo',
        TTL_GENERAL_MS,
        undefined,
        undefined,
        terminosEvento,
      );
    }

    if (intent.type === 'NEGOCIO_BUSQUEDA') {
      const negocios = await this.repository.findNegociosPublicados();
      const respuesta = responderNegocios(
        negocios,
        intent.terminos,
        idioma,
        intent.presupuesto,
        intent.personas,
        intent.tipoPresupuesto,
      );
      return this.guardarRespuesta(cacheKey, pregunta, respuesta, idioma, ip, 'catalogo');
    }

    if (intent.type === 'NEGOCIO_RECOMENDACION') {
      if (!negocioSlug) {
        return this.guardarRespuesta(
          cacheKey,
          pregunta,
          responderAclaracionRecomendacion(idioma),
          idioma,
          ip,
          'catalogo',
        );
      }
      const negocioContextual = negocioSlug
        ? await this.repository.findNegocioPublicadoPorSlug(negocioSlug)
        : null;
      const negocios = negocioSlug
        ? negocioContextual ? [negocioContextual] : []
        : await this.repository.findNegociosPublicados();
      const respuesta = responderRecomendacionNegocios(
        negocios,
        intent.personas,
        idioma,
      );
      return this.guardarRespuesta(cacheKey, pregunta, respuesta, idioma, ip, 'catalogo');
    }

    const { eventos, eventoEspecifico, eventoNoEncontrado } =
      await this.cargarContexto(intent);

    // 2.1 Si pidió un evento específico que no existe, responder sin llamar a Gemini
    if (eventoNoEncontrado) {
      const respuesta = generarFallback({
        eventos: [],
        idioma,
        tipo: 'EVENTO_ESPECIFICO',
        eventoNoEncontrado: true,
      });
      const response: ChatResponse = {
        respuesta,
        fuente: 'fallback',
        idioma,
        ...(eventoId && { eventoId }),
      };
      return this.guardarRespuesta(cacheKey, pregunta, respuesta, idioma, ip, 'fallback', TTL_EVENTO_MS, eventoId);
    }

    // 3. Construir prompt con eventos reales
    const systemPrompt = buildSystemPrompt({ eventos, idioma, eventoEspecifico });

    // 4. Cascada Gemini
    const geminiResult = await this.gemini.generate(pregunta, systemPrompt);

    // 5. Fallback local si la cascada falló
    const fuente: Fuente = geminiResult ? 'gemini' : 'fallback';
    const respuesta = geminiResult?.texto ?? generarFallback({
      eventos,
      idioma,
      tipo: intent.type,
      categoria: intent.type === 'CATEGORIA' ? intent.categoria : undefined,
      eventoEspecifico,
    });

    const response: ChatResponse = {
      respuesta,
      fuente,
      idioma,
      ...(geminiResult && { modelo: geminiResult.modelo }),
      ...(eventoId && { eventoId }),
    };

    // 6. Guardar en caché con TTL según contexto
    return this.guardarRespuesta(
      cacheKey,
      pregunta,
      respuesta,
      idioma,
      ip,
      fuente,
      eventoId ? TTL_EVENTO_MS : TTL_GENERAL_MS,
      eventoId,
      geminiResult?.modelo,
    );
  }

  private guardarRespuesta(
    cacheKey: string,
    pregunta: string,
    respuesta: string,
    idioma: ChatRequest['idioma'],
    ip: string | undefined,
    fuente: Fuente,
    ttl = TTL_EVENTO_MS,
    eventoId?: number,
    modelo?: string,
    contextoEventos?: string[],
  ): ChatResponse {
    const response: ChatResponse = {
      respuesta,
      fuente,
      idioma,
      ...(eventoId && { eventoId }),
      ...(modelo && { modelo }),
      ...(contextoEventos && { contextoEventos }),
    };
    this.cache.set(cacheKey, response, ttl);
    this.guardarLog(pregunta, respuesta, idioma, ip);
    return response;
  }

  private buildCacheKey(
    pregunta: string,
    idioma: string,
    eventoId?: number,
    negocioSlug?: string,
    eventoSlug?: string,
    contextoEventos?: string[],
  ): string {
    const norm = pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CACHE_KEY_MAX_LEN);
    return CacheKeyBuilder.create()
      .ns('ia')
      .entity('chat')
      .attr('q', norm)
      .attr('lang', idioma)
      .attr('evt', eventoId ?? 'general')
      .attr('biz', negocioSlug ?? 'general')
      .attr('event', eventoSlug ?? 'general')
      .attr('eventTerms', contextoEventos?.join('|') ?? 'general')
      .build();
  }

  private preguntaComoLlegar(pregunta: string): boolean {
    const normalizada = pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return /\b(como llegar|como voy|llegar|ruta|mapa|maps|google maps|enlace directo|direcciones|directions|how do i get|how to get|map link|itineraire|comment aller|aller a)\b/.test(normalizada);
  }

  private async cargarContexto(
    intent: Exclude<ReturnType<typeof detectIntent>, { type: 'EVENTO_BUSQUEDA' | 'NEGOCIO_BUSQUEDA' }>
  ): Promise<{
    eventos: EventoContexto[];
    eventoEspecifico?: EventoContexto;
    eventoNoEncontrado?: boolean;
  }> {
    if (intent.type === 'EVENTO_ESPECIFICO') {
      const evento = await this.repository.findEventoById(intent.eventoId);
      if (evento) return { eventos: [evento], eventoEspecifico: evento };
      // El evento no existe o no está APROBADO. NO caemos a findProximos,
      // porque eso confundiría al usuario respondiendo como pregunta general.
      return { eventos: [], eventoNoEncontrado: true };
    }
    if (intent.type === 'GRATIS') {
      return { eventos: await this.repository.findGratuitos() };
    }
    if (intent.type === 'CATEGORIA') {
      return { eventos: await this.repository.findPorCategoria(intent.categoria) };
    }
    return { eventos: await this.repository.findProximos() };
  }

  private guardarLog(
    pregunta: string,
    respuesta: string,
    idioma: string,
    ip?: string
  ): void {
    // Fire-and-forget: no await, no bloquea, no rompe si falla
    prisma.chatLog
      .create({
        data: { pregunta, respuesta, idioma, ipOrigen: ip ?? 'Desconocida' },
      })
      .catch(() => {
        // Silencio intencional: el log nunca debe afectar al usuario
      });
  }
}