import { prisma } from '../../config/database';
import { Prisma, TipoNotificacion } from '@prisma/client';

// Patrón Repository — toda consulta a Evento pasa por aquí
// El servicio nunca toca prisma directamente
export class EventosRepository {

  async findAprobados(
    where: Prisma.EventoWhereInput = {},
    pagina = 1,
    limite = 12,
    orden: 'fecha' | 'recientes' = 'fecha',
    q?: string,
  ) {
    const skip = (pagina - 1) * limite;
    const termino = q?.trim();
    const filtroPublico: Prisma.EventoWhereInput = {
      AND: [
        { estadoPublicacion: 'APROBADO' },
        {
          OR: [
            { organizadorId: null },
            {
              organizador: {
                is: { especialidad: 'EVENTOS', estado: 'VERIFICADO', vetado: false },
              },
            },
          ],
        },
        where,
        ...(termino ? [{
          OR: [
            { titulo: { contains: termino, mode: 'insensitive' as const } },
            { slug: { contains: termino, mode: 'insensitive' as const } },
            { descripcion: { contains: termino, mode: 'insensitive' as const } },
            { direccion: { contains: termino, mode: 'insensitive' as const } },
            { lugar: { is: { nombre: { contains: termino, mode: 'insensitive' as const } } } },
            { lugar: { is: { direccion: { contains: termino, mode: 'insensitive' as const } } } },
            { categoria: { is: { nombre: { contains: termino, mode: 'insensitive' as const } } } },
            { ciudad: { is: { nombre: { contains: termino, mode: 'insensitive' as const } } } },
          ],
        }] : []),
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
        orderBy: orden === 'recientes'
          ? [{ creadoEn: 'desc' }, { id: 'desc' }]
          : { fechaInicio: 'asc' },
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
        organizador: { select: { id: true, nombreEntidad: true } },
      },
    });
  }

  async findPendientes() {
    return prisma.evento.findMany({
      where: { estadoPublicacion: 'PENDIENTE' },
      include: {
        categoria:   { select: { nombre: true } },
        lugar:       { select: { nombre: true } },
        ciudad:      { select: { nombre: true } },
        organizador: { select: { id: true, nombreEntidad: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });
  }

  async findTodos() {
    return prisma.evento.findMany({
      include: {
        categoria: { select: { nombre: true } },
        lugar:     { select: { nombre: true } },
        ciudad:    { select: { nombre: true } },
        organizador: { select: { id: true, nombreEntidad: true } },
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

  async deleteFinalizedEvents(now: Date) {
    const candidates = await prisma.evento.findMany({
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

    const deleted = [];
    for (const evento of candidates) {
      const organizadorId = evento.organizadorId;
      if (organizadorId === null) continue;

      const wasDeleted = await prisma.$transaction(async (tx) => {
        const result = await tx.evento.deleteMany({
          where: {
            id: evento.id,
            fechaFin: { not: null, lt: now },
            estadoPublicacion: 'APROBADO',
            organizadorId,
          },
        });
        if (result.count === 0) return false;

        const organizador = await tx.organizador.findUnique({
          where: { id: organizadorId },
          select: { usuarioId: true },
        });
        if (organizador) {
          await tx.notificacion.create({
            data: {
              usuarioId: organizador.usuarioId,
              tipo: TipoNotificacion.EVENTO_ELIMINADO,
              mensaje: `Tu evento "${evento.titulo}" finalizó y se eliminó automáticamente según la fecha de fin.`,
            },
          });
        }

        return true;
      });

      if (wasDeleted) deleted.push(evento);
    }

    return deleted;
  }
}