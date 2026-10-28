import { prisma } from '../../config/database';

export class UsuariosService {

  async suscribirse(email: string, categoriaId: number) {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) throw new Error('Debes tener una cuenta para suscribirte');

    const existente = await prisma.suscripcion.findUnique({
      where: {
        usuarioId_categoriaId: {
          usuarioId: usuario.id,
          categoriaId,
        },
      },
    });

    if (existente) {
      if (existente.activa) throw new Error('Ya estás suscrito a esta categoría');
      return prisma.suscripcion.update({
        where: { id: existente.id },
        data: { activa: true },
      });
    }

    return prisma.suscripcion.create({
      data: { usuarioId: usuario.id, categoriaId, email },
    });
  }

  async cancelarSuscripcion(email: string, categoriaId: number) {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) throw new Error('Usuario no encontrado');

    await prisma.suscripcion.updateMany({
      where: { usuarioId: usuario.id, categoriaId },
      data: { activa: false },
    });
  }

  async listarSuscripciones(usuarioId: number) {
    return prisma.suscripcion.findMany({
      where: { usuarioId, activa: true },
      include: {
        categoria: { select: { nombre: true, slug: true, icono: true } },
      },
    });
  }
}