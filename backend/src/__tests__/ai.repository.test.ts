const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    evento: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
    },
  },
}));

import { AiRepository } from '../modules/ai/ai.repository';

describe('AiRepository event visibility and date filters', () => {
  const repository = new AiRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);
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
});
