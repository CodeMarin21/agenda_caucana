const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreateEvento = jest.fn();
const mockActualizarOrganizador = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    evento: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreateEvento(...args),
    },
    organizador: { update: (...args: unknown[]) => mockActualizarOrganizador(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { EventosRepository } from '../modules/eventos/eventos.repository';

describe('EventosRepository text search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockCreateEvento.mockResolvedValue({ id: 21 });
    mockActualizarOrganizador.mockResolvedValue({});
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        evento: { create: (...args: unknown[]) => mockCreateEvento(...args) },
        organizador: { update: (...args: unknown[]) => mockActualizarOrganizador(...args) },
      }),
    );
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

  it('saves the organizer event specialty in the same transaction as the event', async () => {
    const data = { titulo: 'Evento de prueba' } as never;

    await new EventosRepository().create(data, 12);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateEvento).toHaveBeenCalledWith(expect.objectContaining({ data }));
    expect(mockActualizarOrganizador).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { especialidad: 'EVENTOS' },
    });
  });
});
