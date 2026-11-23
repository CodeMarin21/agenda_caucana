import { prisma } from '../../config/database';

export class NotificacionesRepository {
  async listarPorUsuario(usuarioId: number, pagina: number, limite: number) {
    const where = { usuarioId };
    const skip = (pagina - 1) * limite;

    const [notificaciones, total, noLeidas] = await Promise.all([
      prisma.notificacion.findMany({
        where,
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        skip,
        take: limite,
      }),
      prisma.notificacion.count({ where }),
      prisma.notificacion.count({ where: { usuarioId, leida: false } }),
    ]);

    return {
      notificaciones,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
      noLeidas,
    };
  }

  async marcarLeida(usuarioId: number, notificacionId: number): Promise<boolean> {
    const resultado = await prisma.notificacion.updateMany({
      where: { id: notificacionId, usuarioId, leida: false },
      data: { leida: true },
    });
    return resultado.count > 0;
  }

  async marcarTodasLeidas(usuarioId: number): Promise<number> {
    const resultado = await prisma.notificacion.updateMany({
      where: { usuarioId, leida: false },
      data: { leida: true },
    });
    return resultado.count;
  }
}
