const mockQueryRaw = jest.fn();
const mockCount = jest.fn();
const mockFindMany = jest.fn();
const mockGroupBy = jest.fn();
const mockTransaction = jest.fn();
const mockNegocioFindUnique = jest.fn();
const mockNegocioDelete = jest.fn();
const mockOrganizadorUpdate = jest.fn();
const mockNotificacionCreate = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    negocio: {
      count: (...args: unknown[]) => mockCount(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    organizador: { update: (...args: unknown[]) => mockOrganizadorUpdate(...args) },
    notificacion: { create: (...args: unknown[]) => mockNotificacionCreate(...args) },
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
    mockNegocioFindUnique.mockResolvedValue(null);
    mockNegocioDelete.mockResolvedValue({ id: 25 });
    mockOrganizadorUpdate.mockResolvedValue({});
    mockNotificacionCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((operation) => operation({
      negocio: {
        findUnique: mockNegocioFindUnique,
        delete: mockNegocioDelete,
      },
      organizador: { update: mockOrganizadorUpdate },
      notificacion: { create: mockNotificacionCreate },
    }));
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

  it('releases the organizer business slot transactionally when the owner deletes it', async () => {
    mockNegocioFindUnique.mockResolvedValue({
      id: 25,
      nombre: 'Negocio de prueba',
      organizadorId: 8,
      organizador: { id: 8, usuarioId: 12 },
    });

    await repository.delete(25, undefined, true);

    expect(mockNegocioDelete).toHaveBeenCalledWith({ where: { id: 25 } });
    expect(mockOrganizadorUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { negocioCreado: false },
    });
  });

  it('keeps the organizer slot consumed when an administrator deletes the business', async () => {
    mockNegocioFindUnique.mockResolvedValue({
      id: 25,
      nombre: 'Negocio de prueba',
      organizadorId: 8,
      organizador: { id: 8, usuarioId: 12 },
    });

    await repository.delete(25, 'Motivo administrativo', false);

    expect(mockOrganizadorUpdate).not.toHaveBeenCalled();
    expect(mockNotificacionCreate).toHaveBeenCalled();
  });
});
