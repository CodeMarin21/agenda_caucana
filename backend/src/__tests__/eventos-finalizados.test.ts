const mockFindMany = jest.fn();
const mockDeleteMany = jest.fn();
const mockFindOrganizer = jest.fn();
const mockCreateNotification = jest.fn();
const mockTransaction = jest.fn();

const transactionClient = {
  evento: { deleteMany: mockDeleteMany },
  organizador: { findUnique: mockFindOrganizer },
  notificacion: { create: mockCreateNotification },
};

jest.mock('../config/database', () => ({
  prisma: {
    evento: { findMany: mockFindMany },
    $transaction: mockTransaction,
  },
}));

import { EventosRepository } from '../modules/eventos/eventos.repository';

describe('EventosRepository.deleteFinalizedEvents', () => {
  const repository = new EventosRepository();
  const now = new Date('2026-11-20T15:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([{
      id: 27,
      titulo: 'Concierto finalizado',
      publicIdImagen: null,
      organizadorId: 8,
    }]);
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockFindOrganizer.mockResolvedValue({ usuarioId: 19 });
    mockCreateNotification.mockResolvedValue({});
    mockTransaction.mockImplementation(
      (operation: (tx: typeof transactionClient) => Promise<unknown>) => operation(transactionClient)
    );
  });

  it('only considers expired approved events owned by organizers, preserving demo events', async () => {
    const deleted = await repository.deleteFinalizedEvents(now);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        fechaFin: { not: null, lt: now },
        estadoPublicacion: 'APROBADO',
        organizadorId: { not: null },
      },
      select: {
        id: true,
        titulo: true,
        publicIdImagen: true,
        organizadorId: true,
      },
    });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        id: 27,
        fechaFin: { not: null, lt: now },
        estadoPublicacion: 'APROBADO',
        organizadorId: 8,
      },
    });
    expect(deleted).toHaveLength(1);
    expect(mockCreateNotification).toHaveBeenCalledWith({
      data: {
        usuarioId: 19,
        tipo: 'EVENTO_ELIMINADO',
        mensaje: 'Tu evento "Concierto finalizado" finalizó y se eliminó automáticamente según la fecha de fin.',
      },
    });
  });

  it('does not notify or report an event changed before the atomic delete', async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const deleted = await repository.deleteFinalizedEvents(now);

    expect(deleted).toHaveLength(0);
    expect(mockFindOrganizer).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
