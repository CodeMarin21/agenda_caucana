const mockQueryRaw = jest.fn();
const mockCount = jest.fn();
const mockFindMany = jest.fn();
const mockGroupBy = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    negocio: {
      count: (...args: unknown[]) => mockCount(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    calificacionNegocio: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
  },
}));

import { NegociosRepository } from '../modules/negocios/negocios.repository';

describe('NegociosRepository search and price filters', () => {
  const repository = new NegociosRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
    mockGroupBy.mockResolvedValue([]);
  });

  it('uses significant words when the full name query has a typo', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 18 }]);

    await repository.findAll({
      q: 'soculentas de juanita',
      orden: 'recientes',
      pagina: 1,
      limite: 20,
    });

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(mockCount.mock.calls[0][0].where.id).toEqual({ in: [18] });
  });

  it('applies both ends of a selected price range in the database query', async () => {
    await repository.findAll({
      precioMin: 10000,
      precioMax: 30000,
      orden: 'recientes',
      pagina: 1,
      limite: 20,
    });

    expect(mockCount.mock.calls[0][0].where.precioPromedio).toEqual({
      gte: 10000,
      lte: 30000,
    });
  });
});
