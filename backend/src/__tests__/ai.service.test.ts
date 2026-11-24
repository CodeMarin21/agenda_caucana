const mockCreateChatLog = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    chatLog: { create: mockCreateChatLog },
  },
}));

import { MemoryCacheService } from '../cache/MemoryCacheService';
import { AiRepository } from '../modules/ai/ai.repository';
import { detectIntent } from '../modules/ai/ai.intent';
import { AiService } from '../modules/ai/ai.service';
import { GeminiClient } from '../modules/ai/gemini.client';
import { EventoContexto, NegocioContexto } from '../modules/ai/ai.types';
import { PeriodoEventos } from '../modules/ai/ai.temporal';

class FakeAiRepository extends AiRepository {
  periodosConsultados: Array<{
    periodo: PeriodoEventos;
    terminos: string[];
    soloFinalizados: boolean;
  }> = [];
  eventosFinalizados: EventoContexto[] = [];
  negocioPublicado: NegocioContexto | null = null;
  eventoPublicado: EventoContexto | null = null;
  slugConsultado: string | null = null;
  consultasEventosProximos = 0;
  terminosDirectosConsultados: string[][] = [];

  override async findEventosEnPeriodo(
    periodo: PeriodoEventos,
    terminos: string[] = [],
    soloFinalizados = false,
  ): Promise<EventoContexto[]> {
    this.periodosConsultados.push({ periodo, terminos, soloFinalizados });
    return this.eventosFinalizados.filter((evento) => {
      const texto = `${evento.titulo} ${evento.descripcion} ${evento.categoria.nombre}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const coincidePeriodo = evento.fechaInicio < periodo.hasta &&
        (evento.fechaFin
          ? evento.fechaFin >= periodo.desde
          : evento.fechaInicio >= periodo.desde);
      const disponible = !periodo.soloVigentes ||
        (evento.fechaFin ? evento.fechaFin >= new Date() : evento.fechaInicio >= new Date());
      return coincidePeriodo && disponible && terminos.every((termino) => texto.includes(termino));
    });
  }

  override async findEventosPorTerminos(terminos: string[]): Promise<EventoContexto[]> {
    this.terminosDirectosConsultados.push(terminos);
    return this.eventosFinalizados.filter((evento) => {
      const texto = `${evento.titulo} ${evento.descripcion} ${evento.categoria.nombre}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return terminos.every((termino) => texto.includes(termino));
    });
  }

  override async findFinalizados(): Promise<EventoContexto[]> {
    return this.eventosFinalizados;
  }

  override async findNegocioPublicadoPorSlug(slug: string): Promise<NegocioContexto | null> {
    this.slugConsultado = slug;
    return this.negocioPublicado?.slug === slug ? this.negocioPublicado : null;
  }

  override async findProximos(): Promise<EventoContexto[]> {
    this.consultasEventosProximos += 1;
    return [];
  }

  override async findEventoPublicadoPorSlug(slug: string): Promise<EventoContexto | null> {
    return this.eventoPublicado?.slug === slug ? this.eventoPublicado : null;
  }
}

class FakeGemini extends GeminiClient {
  llamadas = 0;

  constructor() {
    super({ apiKey: '', modelos: [], maxOutputTokens: 100, temperature: 0 });
  }

  override async generate() {
    this.llamadas += 1;
    return null;
  }
}

function evento(id: number, titulo: string, inicio: string, fin: string): EventoContexto {
  return {
    id,
    titulo,
    slug: titulo.toLowerCase().replace(/\s+/g, '-'),
    descripcion: 'Evento de prueba para fechas del calendario.',
    fechaInicio: new Date(inicio),
    fechaFin: new Date(fin),
    horaApertura: null,
    direccion: null,
    precioReferencial: 0,
    esMayorDeEdad: false,
    categoria: { nombre: 'Cultura' },
    lugar: { nombre: 'Centro', direccion: 'Popayán' },
    ciudad: { nombre: 'Popayán' },
  };
}

describe('AiService temporal queries', () => {
  let repository: FakeAiRepository;
  let gemini: FakeGemini;
  let cache: MemoryCacheService;
  let service: AiService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateChatLog.mockResolvedValue({});
    repository = new FakeAiRepository();
    gemini = new FakeGemini();
    cache = new MemoryCacheService();
    service = new AiService(repository, gemini, cache);
  });

  afterEach(() => {
    cache.dispose();
    jest.useRealTimers();
  });

  it('returns only events matching October that have already ended without calling Gemini', async () => {
    repository.eventosFinalizados = [
      evento(10, 'Feria del Libro', '2026-10-14T18:24:00.000Z', '2026-10-28T06:22:00.000Z'),
      evento(9, 'Velada del barrio', '2026-10-31T04:50:00.000Z', '2026-10-31T16:52:00.000Z'),
    ];

    const response = await service.chat({
      pregunta: 'y en octubre y los que ya pasaron',
      idioma: 'es',
    });

    expect(response.fuente).toBe('catalogo');
    expect(response.respuesta).toContain('Feria del Libro');
    expect(response.respuesta).toContain('Velada del barrio');
    expect(response.respuesta).not.toContain('SalchiFest');
    expect(repository.periodosConsultados).toHaveLength(1);
    expect(repository.periodosConsultados[0].soloFinalizados).toBe(true);
    expect(gemini.llamadas).toBe(0);
  });

  it('returns an event spanning the requested November date with its real start and end', async () => {
    repository.eventosFinalizados = [
      evento(11, 'SalchiFest 2026 Popayán', '2026-11-01T14:34:00.000Z', '2026-12-16T02:34:00.000Z'),
    ];

    const response = await service.chat({
      pregunta: 'que eventos hay disponibles para el este 20 de nvoeimbre',
      idioma: 'es',
    });

    expect(response.respuesta).toContain('SalchiFest 2026 Popayán');
    expect(response.respuesta).toContain('noviembre');
    expect(response.respuesta).toContain('diciembre');
    expect(repository.periodosConsultados[0].soloFinalizados).toBe(false);
    expect(gemini.llamadas).toBe(0);
  });

  it('uses the previous business context for a directions follow-up', async () => {
    repository.negocioPublicado = {
      id: 8,
      slug: 'cafe-popayan',
      nombre: 'Café Popayán',
      descripcion: 'Café tradicional',
      direccion: 'Calle 5 # 4-30, Centro',
      telefono: null,
      whatsapp: null,
      horarioAtencion: null,
      categoria: 'CAFETERIA',
      precioPromedio: 8000,
      platos: [],
      ciudad: { nombre: 'Popayán' },
    };

    const response = await service.chat({
      pregunta: 'dame un enlace directo para poder llegar',
      negocioSlug: 'cafe-popayan',
      idioma: 'es',
    });

    expect(response.respuesta).toContain('Café Popayán');
    expect(response.respuesta).toContain('google.com/maps/search/?api=1');
    expect(response.respuesta).toContain(encodeURIComponent('Calle 5 # 4-30, Centro'));
    expect(gemini.llamadas).toBe(0);
  });

  it('uses the previous pizza listing for a group-size recommendation instead of returning events', async () => {
    repository.negocioPublicado = {
      id: 14,
      slug: 'forno-urbano-pizza',
      nombre: 'Forno Urbano Pizza',
      descripcion: 'Pizzería en Popayán',
      direccion: 'Cra 10A #2n-35',
      telefono: null,
      whatsapp: null,
      horarioAtencion: null,
      categoria: 'PIZZA',
      precioPromedio: 25,
      platos: [
        { nombre: 'Pizza Hawaiana', precio: 23, descripcion: 'Para dos personas' },
        { nombre: 'Pizza Pepperoni Grande', precio: 24, descripcion: 'Pizza grande de pepperoni' },
        { nombre: 'Pizza Pollo y Champiñones', precio: 30, descripcion: 'Pizza familiar. Para 4 personas' },
      ],
      ciudad: { nombre: 'Popayán' },
    };

    const response = await service.chat({
      pregunta: 'somos 4 personas cual me recomiendas?',
      negocioSlug: 'forno-urbano-pizza',
      idioma: 'es',
    });

    expect(response.fuente).toBe('catalogo');
    expect(response.respuesta).toContain('Pizza Pollo y Champiñones');
    expect(response.respuesta).toContain('indica que alcanza para 4');
    expect(response.respuesta).not.toContain('SalchiFest');
    expect(repository.slugConsultado).toBe('forno-urbano-pizza');
    expect(repository.consultasEventosProximos).toBe(0);
    expect(gemini.llamadas).toBe(0);
  });

  it('uses the previously mentioned event when the user asks for its start and end times', async () => {
    repository.eventoPublicado = evento(
      15,
      'Popayán Música de Cámara Festival Internacional',
      '2026-11-23T23:24:00.000Z',
      '2026-11-28T23:20:00.000Z',
    );

    const response = await service.chat({
      pregunta: 'cuando inicia y cuando termina el evento?',
      eventoSlug: repository.eventoPublicado.slug,
      idioma: 'es',
    });

    expect(response.respuesta).toContain('Inicio:');
    expect(response.respuesta).toContain('Fin:');
    expect(response.respuesta).toContain('23 de noviembre de 2026');
    expect(response.respuesta).toContain('28 de noviembre de 2026');
    expect(response.respuesta).not.toContain('No encuentro un evento publicado');
    expect(repository.consultasEventosProximos).toBe(0);
    expect(gemini.llamadas).toBe(1);
  });

  it('answers whether the current event has free entry from its published price', async () => {
    repository.eventoPublicado = evento(
      15,
      'Popayán Música de Cámara Festival Internacional',
      '2026-11-23T23:24:00.000Z',
      '2026-11-28T23:20:00.000Z',
    );

    const response = await service.chat({
      pregunta: 'la entrada es libre?',
      eventoSlug: repository.eventoPublicado.slug,
      idioma: 'es',
    });

    expect(response.respuesta).toContain('Sí.');
    expect(response.respuesta).toContain('entrada es libre');
    expect(response.respuesta).toContain('Popayán Música de Cámara Festival Internacional');
    expect(response.fuente).toBe('catalogo');
    expect(gemini.llamadas).toBe(0);
    expect(repository.consultasEventosProximos).toBe(0);
  });

  it('does not claim free entry when the event listing has no price', async () => {
    repository.eventoPublicado = {
      ...evento(
        15,
        'Concierto sin precio informado',
        '2026-11-23T23:24:00.000Z',
        '2026-11-28T23:20:00.000Z',
      ),
      precioReferencial: null,
    };

    const response = await service.chat({
      pregunta: 'la entrada es libre?',
      eventoSlug: repository.eventoPublicado.slug,
      idioma: 'es',
    });

    expect(response.respuesta).toContain('no indica el precio de entrada');
    expect(response.respuesta).toContain('no puedo confirmar si es libre');
    expect(response.respuesta).not.toContain('Sí.');
    expect(gemini.llamadas).toBe(0);
  });

  it('does not classify a music-event search as a follow-up question', () => {
    expect(detectIntent('no hay eventos de musica?').type).toBe('EVENTO_BUSQUEDA');
  });

  it('keeps the music filter across weekend, tomorrow, and today follow-ups', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-23T19:22:00-05:00'));
    repository.eventosFinalizados = [
      evento(
        15,
        'Popayán Música de Cámara Festival Internacional',
        '2026-11-23T23:24:00.000Z',
        '2026-11-28T23:20:00.000Z',
      ),
      evento(
        16,
        'SalchiFest 2026 Popayán',
        '2026-11-01T14:34:00.000Z',
        '2026-12-16T02:34:00.000Z',
      ),
    ];

    const finDeSemana = await service.chat({
      pregunta: 'que eventos de musica hay para este finde de semana?',
      idioma: 'es',
    });
    expect(finDeSemana.contextoEventos).toEqual(['musica']);
    expect(finDeSemana.respuesta).toContain('Popayán Música de Cámara');
    expect(finDeSemana.respuesta).not.toContain('SalchiFest');

    const manana = await service.chat({
      pregunta: 'y para mañana cuales estan disponibles?',
      idioma: 'es',
      contextoEventos: finDeSemana.contextoEventos,
    });
    expect(manana.contextoEventos).toEqual(['musica']);
    expect(repository.periodosConsultados[1].terminos).toEqual(['musica']);
    expect(manana.respuesta).toContain('Popayán Música de Cámara');
    expect(manana.respuesta).not.toContain('SalchiFest');

    const hoy = await service.chat({
      pregunta: 'y para hoy?',
      idioma: 'es',
      contextoEventos: manana.contextoEventos,
    });
    expect(repository.periodosConsultados[2].terminos).toEqual(['musica']);
    expect(hoy.respuesta).toContain('Popayán Música de Cámara');
    expect(hoy.respuesta).not.toContain('SalchiFest');
  });

  it('searches only music events when the user corrects a mixed-topic answer', async () => {
    repository.eventosFinalizados = [
      evento(15, 'Popayán Música de Cámara Festival Internacional', '2026-11-23T23:24:00.000Z', '2026-11-28T23:20:00.000Z'),
      evento(16, 'SalchiFest 2026 Popayán', '2026-11-01T14:34:00.000Z', '2026-12-16T02:34:00.000Z'),
    ];

    const response = await service.chat({
      pregunta: 'pero te pedi evento de musica no de comidas',
      idioma: 'es',
    });

    expect(repository.terminosDirectosConsultados).toEqual([['musica']]);
    expect(response.respuesta).toContain('Popayán Música de Cámara');
    expect(response.respuesta).not.toContain('SalchiFest');
  });

  it('asks for a domain before making an ungrounded generic recommendation', async () => {
    const response = await service.chat({
      pregunta: 'que me recomiendas?',
      idioma: 'es',
    });

    expect(response.respuesta).toContain('comida o de eventos');
    expect(repository.consultasEventosProximos).toBe(0);
    expect(repository.slugConsultado).toBeNull();
    expect(gemini.llamadas).toBe(0);
  });
});
