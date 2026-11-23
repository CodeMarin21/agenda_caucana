const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    evento: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { EventosRepository } from '../modules/eventos/eventos.repository';

describe('EventosRepository text search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('matches event titles, places, addresses, categories, and cities', async () => {
    await new EventosRepository().findAprobados({}, 1, 12, 'fecha', 'SalchiFest');

    const filtro = mockFindMany.mock.calls[0][0].where.AND;
    expect(filtro).toEqual(expect.arrayContaining([
      expect.objectContaining({
        OR: expect.arrayContaining([
          { titulo: { contains: 'SalchiFest', mode: 'insensitive' } },
          { slug: { contains: 'SalchiFest', mode: 'insensitive' } },
          { direccion: { contains: 'SalchiFest', mode: 'insensitive' } },
        ]),
      }),
    ]));
  });
});
