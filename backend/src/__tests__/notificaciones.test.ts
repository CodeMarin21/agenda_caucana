const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    notificacion: {
      findMany: mockFindMany,
      count: mockCount,
      updateMany: mockUpdateMany,
    },
  },
}));

import { NotificacionesRepository } from '../modules/notificaciones/notificaciones.repository';

describe('NotificacionesRepository', () => {
  const repository = new NotificacionesRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('lists only the signed-in organizer notifications and unread count', async () => {
    const result = await repository.listarPorUsuario(42, 2, 20);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { usuarioId: 42 },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      skip: 20,
      take: 20,
    });
    expect(mockCount).toHaveBeenNthCalledWith(1, { where: { usuarioId: 42 } });
    expect(mockCount).toHaveBeenNthCalledWith(2, {
      where: { usuarioId: 42, leida: false },
    });
    expect(result).toEqual({
      notificaciones: [],
      paginacion: { total: 0, pagina: 2, limite: 20, totalPaginas: 0 },
      noLeidas: 0,
    });
  });

  it('marks a notification read only when it belongs to that organizer', async () => {
    await repository.marcarLeida(42, 15);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 15, usuarioId: 42, leida: false },
      data: { leida: true },
    });
  });

  it('marks all unread notifications only for the requested organizer', async () => {
    const count = await repository.marcarTodasLeidas(42);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { usuarioId: 42, leida: false },
      data: { leida: true },
    });
    expect(count).toBe(1);
  });
});
