const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockQueryRaw = jest.fn();
const mockCreateEvento = jest.fn();
const mockActualizarOrganizador = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
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
    mockQueryRaw.mockResolvedValue([]);
    mockCreateEvento.mockResolvedValue({ id: 21 });
    mockActualizarOrganizador.mockResolvedValue({});
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        evento: { create: (...args: unknown[]) => mockCreateEvento(...args) },
        organizador: { update: (...args: unknown[]) => mockActualizarOrganizador(...args) },
      }),
    );
  });

  it('matches every meaningful search word accent-insensitively across event fields', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 21 }]);

    await new EventosRepository().findAprobados({}, 1, 12, 'fecha', 'SalchiFest de Popayán');

    const consulta = mockQueryRaw.mock.calls[0].find((argumento: unknown) =>
      argumento !== null &&
      typeof argumento === 'object' &&
      'strings' in argumento,
    ) as { strings: string[]; values: unknown[] } | undefined;
    expect(consulta?.strings.join('')).toContain('unaccent(evento."titulo")');
    expect(consulta?.strings.join('')).toContain('unaccent(lugar."nombre")');
    expect(consulta?.strings.join('')).toContain(' AND ');
    expect(consulta?.values).toEqual(expect.arrayContaining([
      '%salchifest%',
      '%popayan%',
    ]));
    expect(consulta?.values).not.toContain('%de%');
    expect(mockFindMany.mock.calls[0][0].where.AND).toContainEqual({ id: { in: [21] } });
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
