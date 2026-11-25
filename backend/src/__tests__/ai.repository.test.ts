const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockQueryRaw = jest.fn();
const mockNegocioFindMany = jest.fn();
const mockNegocioFindFirst = jest.fn();
const mockCalificacionGroupBy = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    evento: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
    negocio: {
      findMany: mockNegocioFindMany,
      findFirst: mockNegocioFindFirst,
    },
    calificacionNegocio: {
      groupBy: mockCalificacionGroupBy,
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { AiRepository } from '../modules/ai/ai.repository';

describe('AiRepository event visibility and date filters', () => {
  const repository = new AiRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);
    mockQueryRaw.mockResolvedValue([]);
    mockNegocioFindMany.mockResolvedValue([]);
    mockNegocioFindFirst.mockResolvedValue(null);
    mockCalificacionGroupBy.mockResolvedValue([]);
  });

  it('finds events overlapping the requested local-day interval and keeps only public publishers', async () => {
    const desde = new Date('2026-11-20T05:00:00.000Z');
    const hasta = new Date('2026-11-21T05:00:00.000Z');

    await repository.findEventosEnPeriodo({ desde, hasta }, [], false);

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ estadoPublicacion: 'APROBADO' }),
      expect.objectContaining({
        OR: expect.arrayContaining([
          { organizadorId: null },
          {
            organizador: {
              is: {
                especialidad: 'EVENTOS',
                estado: 'VERIFICADO',
                vetado: false,
              },
            },
          },
        ]),
      }),
      expect.objectContaining({
        fechaInicio: { lt: hasta },
        OR: [
          { fechaFin: { gte: desde } },
          { fechaFin: null, fechaInicio: { gte: desde } },
        ],
      }),
    ]));
  });

  it('restricts past-event queries to published public events that have ended', async () => {
    await repository.findFinalizados();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ estadoPublicacion: 'APROBADO' }),
      expect.objectContaining({
        OR: expect.arrayContaining([
          { fechaFin: { lt: expect.any(Date) } },
          { fechaFin: null, fechaInicio: { lt: expect.any(Date) } },
        ]),
      }),
    ]));
  });

  it('does not classify events with an unspecified price as free', async () => {
    await repository.findGratuitos();

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.AND).toEqual(expect.arrayContaining([
      { OR: [{ precioReferencial: 0 }] },
    ]));
  });

  it('filters upcoming venue searches by zero admission price', async () => {
    await repository.findEventosPorTerminos([], true);

    const consulta = mockFindMany.mock.calls[0][0];
    expect(consulta.where.AND).toEqual(expect.arrayContaining([
      { precioReferencial: 0 },
      expect.objectContaining({ OR: expect.arrayContaining([
        { fechaFin: { gte: expect.any(Date) } },
      ]) }),
    ]));
  });

  it('orders recent-event searches by publication creation time', async () => {
    await repository.findEventosRecientes();

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { creadoEn: 'desc' },
      where: expect.objectContaining({ AND: expect.any(Array) }),
    }));
  });

  it('loads published-business review averages and review counts in one aggregate query', async () => {
    mockNegocioFindMany.mockResolvedValue([{
      id: 8,
      slug: 'cafe-popayan',
      nombre: 'Café Popayán',
      descripcion: 'Café tradicional',
      direccion: 'Centro',
      telefono: null,
      whatsapp: null,
      horarioAtencion: null,
      categoria: 'CAFETERIA',
      precioPromedio: 8000,
      platos: [],
      ciudad: { nombre: 'Popayán' },
      creadoEn: new Date('2026-11-20T12:00:00.000Z'),
    }]);
    mockCalificacionGroupBy.mockResolvedValue([{
      negocioId: 8,
      _avg: { estrellas: 4.7 },
      _count: { _all: 14 },
    }]);

    const negocios = await repository.findNegociosPublicados(true);

    expect(negocios[0]).toMatchObject({
      promedioEstrellas: 4.7,
      totalCalificaciones: 14,
    });
    expect(mockCalificacionGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['negocioId'],
      where: { negocioId: { in: [8] } },
      _avg: { estrellas: true },
      _count: { _all: true },
    }));
  });

  it('finds published events when search terms omit accents', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 15 }]);

    await repository.findEventosPorTerminos(['musica', 'camara', 'festival']);

    const condicion = mockQueryRaw.mock.calls[0].find((argumento: unknown) =>
      argumento !== null &&
      typeof argumento === 'object' &&
      'strings' in argumento,
    ) as { strings: string[] } | undefined;
    expect(condicion?.strings.join('')).toContain('unaccent(evento."titulo")');
    expect(condicion?.strings.join('')).toContain('unaccent(categoria."nombre")');
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([
        expect.objectContaining({
          estadoPublicacion: 'APROBADO',
        }),
        { id: { in: [15] } },
      ]) },
    }));
  });

  it('applies accent-insensitive terms together with the requested period', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 15 }]);
    const desde = new Date('2026-11-28T05:00:00.000Z');
    const hasta = new Date('2026-11-30T05:00:00.000Z');

    await repository.findEventosEnPeriodo(
      { desde, hasta, rangoDias: true },
      ['musica'],
      false,
    );

    const consulta = mockQueryRaw.mock.calls[0].find((argumento: unknown) =>
      argumento !== null &&
      typeof argumento === 'object' &&
      'strings' in argumento,
    ) as { strings: string[] } | undefined;
    expect(consulta?.strings.join('')).toContain('unaccent(evento."titulo")');
    expect(consulta?.strings.join('')).toContain('evento."fechaFin" >= ');
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ id: { in: [15] } }),
        ]),
      }),
    }));
  });

  it('excludes events that have already ended from a today availability query', async () => {
    const desde = new Date('2026-11-23T05:00:00.000Z');
    const hasta = new Date('2026-11-24T05:00:00.000Z');

    await repository.findEventosEnPeriodo(
      { desde, hasta, diaCompleto: true, soloVigentes: true },
      [],
      false,
    );

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({
        OR: expect.arrayContaining([
          { fechaFin: { gte: expect.any(Date) } },
          { fechaFin: null, fechaInicio: { gte: expect.any(Date) } },
        ]),
      }),
    ]));
  });
});
