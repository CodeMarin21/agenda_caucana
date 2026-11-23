const mockCreateChatLog = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    chatLog: { create: mockCreateChatLog },
  },
}));

import { MemoryCacheService } from '../cache/MemoryCacheService';
import { AiRepository } from '../modules/ai/ai.repository';
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

  override async findEventosEnPeriodo(
    periodo: PeriodoEventos,
    terminos: string[] = [],
    soloFinalizados = false,
  ): Promise<EventoContexto[]> {
    this.periodosConsultados.push({ periodo, terminos, soloFinalizados });
    return this.eventosFinalizados;
  }

  override async findFinalizados(): Promise<EventoContexto[]> {
    return this.eventosFinalizados;
  }

  override async findNegocioPublicadoPorSlug(): Promise<NegocioContexto | null> {
    return this.negocioPublicado;
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

  afterEach(() => cache.dispose());

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
});
