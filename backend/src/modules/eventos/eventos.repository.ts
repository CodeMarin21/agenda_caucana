import { prisma } from '../../config/database';
import { Prisma, TipoNotificacion } from '@prisma/client';

// Patrón Repository — toda consulta a Evento pasa por aquí
// El servicio nunca toca prisma directamente
export class EventosRepository {

  async findAprobados(where: Prisma.EventoWhereInput = {}, pagina = 1, limite = 12) {
    const skip = (pagina - 1) * limite;
    const filtroPublico: Prisma.EventoWhereInput = {
      AND: [
        { estadoPublicacion: 'APROBADO' },
        {
          OR: [
            { organizadorId: null },
            { organizador: { is: { estado: 'VERIFICADO', vetado: false } } },
          ],
        },
        where,
      ],
    };

    const [eventos, total] = await Promise.all([
      prisma.evento.findMany({
        where: filtroPublico,
        include: {
          categoria: { select: { id: true, nombre: true, slug: true, icono: true } },
          lugar:     { select: { id: true, nombre: true, direccion: true } },
          ciudad:    { select: { id: true, nombre: true } },
          organizador: { select: { id: true, nombreEntidad: true } },
        },
        orderBy: { fechaInicio: 'asc' },
        skip,
        take: limite,
      }),
      prisma.evento.count({
        where: filtroPublico,
      }),
    ]);

    return {
      eventos,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  async findBySlug(slug: string) {
    return prisma.evento.findUnique({
      where: { slug },
      include: {
        categoria:    true,
        lugar:        true,
        ciudad:       true,
        organizador:  { include: { usuario: { select: { nombre: true, email: true } } } },
        boletas:      true,
      },
    });
  }

  async findById(id: number) {
    return prisma.evento.findUnique({
      where: { id },
      include: {
        categoria: true,
        lugar:     true,
        ciudad:    true,
      },
    });
  }

  async findPendientes() {
    return prisma.evento.findMany({
      where: { estadoPublicacion: 'PENDIENTE' },
      include: {
        categoria:   { select: { nombre: true } },
        lugar:       { select: { nombre: true } },
        organizador: { select: { nombreEntidad: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async findTodos() {
    return prisma.evento.findMany({
      include: {
        categoria: { select: { nombre: true } },
        lugar:     { select: { nombre: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async create(data: Prisma.EventoCreateInput) {
    return prisma.evento.create({
      data,
      include: { categoria: true, lugar: true, ciudad: true },
    });
  }

  async updateDestacado(id: number, destacado: boolean) {
    return prisma.evento.update({
      where: { id },
      data: { destacado },
      include: { categoria: true, lugar: true },
    });
  }

  async aprobar(id: number) {
    return prisma.$transaction(async (tx) => {
      const evento = await tx.evento.update({
        where: { id },
        data: { estadoPublicacion: 'APROBADO', motivoRechazo: null },
        include: { categoria: true, lugar: true, ciudad: true },
      });

      if (evento.organizadorId) {
        const organizador = await tx.organizador.findUnique({
          where: { id: evento.organizadorId },
          select: { usuarioId: true },
        });
        if (organizador) {
          await tx.notificacion.create({
            data: {
              usuarioId: organizador.usuarioId,
              tipo: TipoNotificacion.EVENTO_APROBADO,
              mensaje: `Tu evento "${evento.titulo}" fue aprobado y ya está publicado.`,
            },
          });
        }
      }

      return evento;
    });
  }

  async rechazar(id: number, motivo: string) {
    return prisma.$transaction(async (tx) => {
      const evento = await tx.evento.update({
        where: { id },
        data: { estadoPublicacion: 'RECHAZADO', motivoRechazo: motivo },
      });

      if (evento.organizadorId) {
        const organizador = await tx.organizador.findUnique({
          where: { id: evento.organizadorId },
          select: { usuarioId: true },
        });
        if (organizador) {
          await tx.notificacion.create({
            data: {
              usuarioId: organizador.usuarioId,
              tipo: TipoNotificacion.EVENTO_RECHAZADO,
              mensaje: `Tu evento "${evento.titulo}" fue rechazado. Motivo: ${motivo}`,
            },
          });
        }
      }

      return evento;
    });
  }

  async delete(id: number, motivo: string) {
    return prisma.$transaction(async (tx) => {
      const evento = await tx.evento.findUnique({ where: { id } });
      if (!evento) throw new Error('Evento no encontrado');

      if (evento.organizadorId) {
        const organizador = await tx.organizador.findUnique({
          where: { id: evento.organizadorId },
          select: { usuarioId: true },
        });
        if (organizador) {
          await tx.notificacion.create({
            data: {
              usuarioId: organizador.usuarioId,
              tipo: TipoNotificacion.EVENTO_ELIMINADO,
              mensaje: `Tu evento "${evento.titulo}" fue eliminado. Motivo: ${motivo}`,
            },
          });
        }
      }

      await tx.evento.delete({ where: { id } });
    });
  }
}