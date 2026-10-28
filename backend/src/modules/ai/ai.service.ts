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
import { detectIntent } from './ai.intent';
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
        process.env.GEMINI_MODEL_FALLBACK1 ?? 'gemini-2.5-flash-lite',
        process.env.GEMINI_MODEL_FALLBACK2 ?? 'gemini-flash-lite-latest',
      ],
      maxOutputTokens: 500,
      temperature: 0.3,
    });
    this.cache = cache;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const { pregunta, idioma, eventoId, ip } = req;

    // 1. Caché: si hay hit, no gastamos cuota ni tocamos la BD
    const cacheKey = this.buildCacheKey(pregunta, idioma, eventoId);
    const cached = this.cache.get<ChatResponse>(cacheKey);
    if (cached) {
      this.guardarLog(pregunta, cached.respuesta, idioma, ip);
      return { ...cached, fuente: 'cache' };
    }

    // 2. Pre-filtrado en PostgreSQL según intención
    const intent = detectIntent(pregunta, eventoId);
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
      this.cache.set(cacheKey, response, TTL_EVENTO_MS);
      this.guardarLog(pregunta, respuesta, idioma, ip);
      return response;
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
    this.cache.set(cacheKey, response, eventoId ? TTL_EVENTO_MS : TTL_GENERAL_MS);

    // 7. Log fire-and-forget
    this.guardarLog(pregunta, respuesta, idioma, ip);

    return response;
  }

  private buildCacheKey(pregunta: string, idioma: string, eventoId?: number): string {
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
      .build();
  }

  private async cargarContexto(
    intent: ReturnType<typeof detectIntent>
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