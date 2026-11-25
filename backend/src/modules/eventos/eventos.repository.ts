import { prisma } from '../../config/database';
import { Prisma, TipoNotificacion } from '@prisma/client';

const PALABRAS_IGNORADAS_BUSQUEDA = new Set([
  'a', 'al', 'algo', 'como', 'con', 'cual', 'cuales', 'de', 'del', 'donde',
  'el', 'ella', 'en', 'entre', 'es', 'esta', 'este', 'la', 'las', 'lo', 'los',
  'mas', 'mi', 'mis', 'o', 'para', 'por', 'que', 'se', 'su', 'sus', 'un',
  'una', 'unas', 'uno', 'unos', 'y', 'the', 'and', 'for', 'in', 'of', 'to',
]);

// Patrón Repository — toda consulta a Evento pasa por aquí
// El servicio nunca toca prisma directamente
export class EventosRepository {

  private async findIdsPorTerminos(termino?: string): Promise<number[] | null> {
    const texto = termino?.trim();
    if (!texto) return null;

    const palabras = [...new Set(
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((palabra) => palabra.length >= 2 && !PALABRAS_IGNORADAS_BUSQUEDA.has(palabra)),
    )];
    if (palabras.length === 0) return [];

    const condiciones = palabras.map((palabra) => {
      const patron = `%${palabra}%`;
      return Prisma.sql`(
        unaccent(evento."titulo") ILIKE unaccent(${patron})
        OR unaccent(evento."slug") ILIKE unaccent(${patron})
        OR unaccent(evento."descripcion") ILIKE unaccent(${patron})
        OR unaccent(evento."direccion") ILIKE unaccent(${patron})
        OR unaccent(categoria."nombre") ILIKE unaccent(${patron})
        OR unaccent(lugar."nombre") ILIKE unaccent(${patron})
        OR unaccent(lugar."direccion") ILIKE unaccent(${patron})
        OR unaccent(ciudad."nombre") ILIKE unaccent(${patron})
      )`;
    });
    const filas = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT evento."id"
      FROM "Evento" AS evento
      LEFT JOIN "Categoria" AS categoria ON categoria."id" = evento."categoriaId"
      LEFT JOIN "Lugar" AS lugar ON lugar."id" = evento."lugarId"
      LEFT JOIN "Ciudad" AS ciudad ON ciudad."id" = evento."ciudadId"
      LEFT JOIN "Organizador" AS organizador ON organizador."id" = evento."organizadorId"
      WHERE evento."estadoPublicacion" = 'APROBADO'
        AND (
          evento."organizadorId" IS NULL
          OR (
            organizador."especialidad" = 'EVENTOS'
            AND organizador."estado" = 'VERIFICADO'
            AND organizador."vetado" = false
          )
        )
        AND ${Prisma.join(condiciones, ' AND ')}
    `;
    return filas.map((fila) => fila.id);
  }

  async findAprobados(
    where: Prisma.EventoWhereInput = {},
    pagina = 1,
    limite = 12,
    orden: 'fecha' | 'recientes' = 'fecha',
    q?: string,
  ) {
    const skip = (pagina - 1) * limite;
    const idsBusqueda = await this.findIdsPorTerminos(q);
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
        ...(idsBusqueda ? [{ id: { in: idsBusqueda } }] : []),
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

  async create(data: Prisma.EventoCreateInput, organizadorId?: number) {
    const crear = (tx: Prisma.TransactionClient) => tx.evento.create({
      data,
      include: { categoria: true, lugar: true, ciudad: true },
    });

    if (!organizadorId) return prisma.evento.create({
      data,
      include: { categoria: true, lugar: true, ciudad: true },
    });

    return prisma.$transaction(async (tx) => {
      const evento = await crear(tx);
      await tx.organizador.update({
        where: { id: organizadorId },
        data: { especialidad: 'EVENTOS' },
      });
      return evento;
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