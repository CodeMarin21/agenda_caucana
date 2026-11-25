const mockFindAprobados = jest.fn();

jest.mock('../modules/eventos/eventos.repository', () => ({
  EventosRepository: jest.fn().mockImplementation(() => ({
    findAprobados: mockFindAprobados,
  })),
}));

jest.mock('../modules/upload/upload.service', () => ({
  UploadService: jest.fn(),
}));

import { EventosService } from '../modules/eventos/eventos.service';

describe('EventosService public filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAprobados.mockResolvedValue({ eventos: [], paginacion: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('limits the default upcoming order to events that have not ended', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T12:00:00.000Z'));

    await new EventosService().listarAprobados({});

    const where = mockFindAprobados.mock.calls[0][0];
    expect(where.AND).toContainEqual({
      OR: [
        { fechaFin: { gte: new Date('2026-11-24T12:00:00.000Z') } },
        { fechaFin: null, fechaInicio: { gte: new Date('2026-11-24T12:00:00.000Z') } },
      ],
    });

  });

  it('only returns events starting within an explicitly selected date range', async () => {
    await new EventosService().listarAprobados({
      desde: '2026-11-02',
      hasta: '2026-11-24',
    });

    const where = mockFindAprobados.mock.calls[0][0];
    expect(where.AND).toContainEqual({
      fechaInicio: {
        gte: new Date('2026-11-02T00:00:00-05:00'),
        lte: new Date('2026-11-24T23:59:59.999-05:00'),
      },
    });
  });

  it('passes exact price filters through to the event repository', async () => {
    await new EventosService().listarAprobados({
      precioMin: 15000,
      precioMax: 15000,
      orden: 'recientes',
    });

    const where = mockFindAprobados.mock.calls[0][0];
    expect(where.AND).toContainEqual({
      precioReferencial: { gte: 15000, lte: 15000 },
    });
  });
});
