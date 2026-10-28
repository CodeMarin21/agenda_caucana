import {
  CategoriaNegocio,
  EstadoNegocio,
  Prisma,
  TipoNotificacion,
} from '@prisma/client';
import { prisma } from '../../config/database';

export interface FiltrosNegocios {
  categoria?: CategoriaNegocio;
  ciudadId?: number;
  precioMax?: number;
  /** Búsqueda de texto libre en nombre y descripción. */
  q?: string;
  orden: 'recientes' | 'destacados' | 'mejor-calificados';
  pagina: number;
  limite: number;
}

export class NegociosRepository {
  private async agregarMetricasCalificacion<T extends { id: number }>(
    negocios: T[]
  ): Promise<Array<T & { promedioEstrellas: number; totalCalificaciones: number }>> {
    if (negocios.length === 0) return [];

    const metricas = await prisma.calificacionNegocio.groupBy({
      by: ['negocioId'],
      where: { negocioId: { in: negocios.map((negocio) => negocio.id) } },
      _avg: { estrellas: true },
      _count: { _all: true },
    });
    const porNegocio = new Map(metricas.map((item) => [item.negocioId, item]));

    return negocios.map((negocio) => {
      const metrica = porNegocio.get(negocio.id);
      return {
        ...negocio,
        promedioEstrellas: metrica?._avg.estrellas ?? 0,
        totalCalificaciones: metrica?._count._all ?? 0,
      };
    });
  }

  /**
   * Pre-query con `unaccent` para conseguir IDs que matchean la
   * búsqueda, sin distinguir mayúsculas ni acentos.
   * Retorna `null` si el filtro `q` no aplica.
   */
  private async obtenerIdsPorBusqueda(
    q: string | undefined,
  ): Promise<number[] | null> {
    const term = q?.trim();
    if (!term) return null;

    const patron = `%${term}%`;
    const filas = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Negocio"
      WHERE unaccent(nombre) ILIKE unaccent(${patron})
         OR unaccent(descripcion) ILIKE unaccent(${patron})
    `;
    return filas.map((f) => f.id);
  }

  private construirWhere(
    filtros: Partial<FiltrosNegocios> = {},
    idsBusqueda: number[] | null = null,
  ): Prisma.NegocioWhereInput {
    const where: Prisma.NegocioWhereInput = {
      estadoPublicacion: EstadoNegocio.APROBADO,
      activo: true,
      OR: [
        { organizadorId: null },
        {
          organizador: {
            is: { estado: 'VERIFICADO', vetado: false },
          },
        },
      ],
      ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
      ...(filtros.ciudadId ? { ciudadId: filtros.ciudadId } : {}),
      ...(filtros.precioMax !== undefined
        ? { precioPromedio: { lte: filtros.precioMax } }
        : {}),
    };

    if (idsBusqueda) {
      where.id = { in: idsBusqueda };
    }

    return where;
  }

  async findAll(filtros: FiltrosNegocios) {
    const idsBusqueda = await this.obtenerIdsPorBusqueda(filtros.q);
    const where = this.construirWhere(filtros, idsBusqueda);
    const skip = (filtros.pagina - 1) * filtros.limite;
    const total = await prisma.negocio.count({ where });

    if (filtros.orden === 'mejor-calificados') {
      const negocios = await prisma.negocio.findMany({
        where,
        include: {
          ciudad: true,
          organizador: {
            select: { id: true, nombreEntidad: true, estado: true, vetado: true },
          },
        },
        orderBy: { creadoEn: 'desc' },
      });
      const conMetricas = await this.agregarMetricasCalificacion(negocios);
      conMetricas.sort((a, b) =>
        b.promedioEstrellas - a.promedioEstrellas ||
        b.totalCalificaciones - a.totalCalificaciones ||
        b.creadoEn.getTime() - a.creadoEn.getTime()
      );
      return {
        negocios: conMetricas.slice(skip, skip + filtros.limite),
        paginacion: {
          total,
          pagina: filtros.pagina,
          limite: filtros.limite,
          totalPaginas: Math.ceil(total / filtros.limite),
        },
      };
    }

    const orderBy: Prisma.NegocioOrderByWithRelationInput[] =
      filtros.orden === 'destacados'
        ? [{ destacado: 'desc' }, { creadoEn: 'desc' }]
        : [{ creadoEn: 'desc' }];
    const negocios = await prisma.negocio.findMany({
      where,
      include: {
        ciudad: true,
        organizador: {
          select: { id: true, nombreEntidad: true, estado: true, vetado: true },
        },
      },
      orderBy,
      skip,
      take: filtros.limite,
    });

    return {
      negocios: await this.agregarMetricasCalificacion(negocios),
      paginacion: {
        total,
        pagina: filtros.pagina,
        limite: filtros.limite,
        totalPaginas: Math.ceil(total / filtros.limite),
      },
    };
  }

  async findBySlug(slug: string) {
    const negocio = await prisma.negocio.findFirst({
      where: {
        slug,
        estadoPublicacion: EstadoNegocio.APROBADO,
        activo: true,
        OR: [
          { organizadorId: null },
          {
            organizador: {
              is: { estado: 'VERIFICADO', vetado: false },
            },
          },
        ],
      },
      include: {
        ciudad: true,
        organizador: {
          select: { id: true, nombreEntidad: true, estado: true, vetado: true },
        },
        calificaciones: {
          select: { estrellas: true, comentario: true, creadoEn: true },
          orderBy: { creadoEn: 'desc' },
          take: 10,
        },
      },
    });
    if (!negocio) return null;

    const [promedio, total] = await Promise.all([
      prisma.calificacionNegocio.aggregate({
        where: { negocioId: negocio.id },
        _avg: { estrellas: true },
      }),
      prisma.calificacionNegocio.count({ where: { negocioId: negocio.id } }),
    ]);
    return {
      ...negocio,
      promedioEstrellas: promedio._avg.estrellas ?? 0,
      totalCalificaciones: total,
    };
  }

  async findById(id: number) {
    return prisma.negocio.findUnique({
      where: { id },
      include: {
        ciudad: true,
        organizador: { select: { id: true, usuarioId: true, nombreEntidad: true } },
      },
    });
  }

  async findByOrganizadorId(organizadorId: number) {
    const negocios = await prisma.negocio.findMany({
      where: { organizadorId },
      include: { ciudad: true },
      orderBy: { creadoEn: 'desc' },
    });
    return this.agregarMetricasCalificacion(negocios);
  }

  async findPendientes() {
    const negocios = await prisma.negocio.findMany({
      where: { estadoPublicacion: EstadoNegocio.PENDIENTE },
      include: {
        ciudad: true,
        organizador: { select: { nombreEntidad: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });
    return this.agregarMetricasCalificacion(negocios);
  }

  async findTodos() {
    const negocios = await prisma.negocio.findMany({
      include: {
        ciudad: true,
        organizador: { select: { nombreEntidad: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });
    return this.agregarMetricasCalificacion(negocios);
  }

  async findOrganizadorByUsuarioId(usuarioId: number) {
    return prisma.organizador.findUnique({
      where: { usuarioId },
      select: { id: true, estado: true, vetado: true },
    });
  }

  async create(data: Prisma.NegocioCreateInput) {
    return prisma.negocio.create({
      data,
      include: { ciudad: true },
    });
  }

  async update(id: number, data: Prisma.NegocioUpdateInput) {
    return prisma.negocio.update({ where: { id }, data });
  }

  async delete(id: number, motivo?: string) {
    return prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.findUnique({
        where: { id },
        include: { organizador: { select: { usuarioId: true } } },
      });
      if (!negocio) throw new Error('Negocio no encontrado');

      if (motivo && negocio.organizador) {
        await tx.notificacion.create({
          data: {
            usuarioId: negocio.organizador.usuarioId,
            tipo: TipoNotificacion.NEGOCIO_ELIMINADO,
            mensaje: `Tu negocio "${negocio.nombre}" fue eliminado. Motivo: ${motivo}`,
          },
        });
      }

      return tx.negocio.delete({ where: { id } });
    });
  }

  async countCalificacionesRecientes(negocioId: number, ipHash: string, desde: Date) {
    return prisma.calificacionNegocio.count({
      where: { negocioId, ipHash, creadoEn: { gte: desde } },
    });
  }

  async crearCalificacion(data: Prisma.CalificacionNegocioUncheckedCreateInput) {
    return prisma.calificacionNegocio.create({
      data,
      select: { estrellas: true, comentario: true, creadoEn: true },
    });
  }

  async promedioYTotalCalificaciones(negocioId: number) {
    const [promedio, total] = await Promise.all([
      prisma.calificacionNegocio.aggregate({
        where: { negocioId },
        _avg: { estrellas: true },
      }),
      prisma.calificacionNegocio.count({ where: { negocioId } }),
    ]);
    return {
      promedioEstrellas: promedio._avg.estrellas ?? 0,
      totalCalificaciones: total,
    };
  }

  async aprobar(id: number) {
    return prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.update({
        where: { id },
        data: { estadoPublicacion: EstadoNegocio.APROBADO, motivoRechazo: null },
        include: {
          organizador: { select: { usuarioId: true } },
          ciudad: true,
        },
      });

      if (negocio.organizador) {
        await tx.notificacion.create({
          data: {
            usuarioId: negocio.organizador.usuarioId,
            tipo: TipoNotificacion.NEGOCIO_APROBADO,
            mensaje: `Tu negocio "${negocio.nombre}" fue aprobado y ya está publicado.`,
          },
        });
      }

      return negocio;
    });
  }

  async rechazar(id: number, motivo: string) {
    return prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.update({
        where: { id },
        data: { estadoPublicacion: EstadoNegocio.RECHAZADO, motivoRechazo: motivo },
        include: { organizador: { select: { usuarioId: true } } },
      });

      if (negocio.organizador) {
        await tx.notificacion.create({
          data: {
            usuarioId: negocio.organizador.usuarioId,
            tipo: TipoNotificacion.NEGOCIO_RECHAZADO,
            mensaje: `Tu negocio "${negocio.nombre}" fue rechazado. Motivo: ${motivo}`,
          },
        });
      }

      return negocio;
    });
  }
}
