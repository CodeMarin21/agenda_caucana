import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { EventoContexto, NegocioContexto } from './ai.types';
import { PeriodoEventos } from './ai.temporal';

function filtroFechaProximos(): Prisma.EventoWhereInput {
  const ahora = new Date();
  return {
    OR: [
      { fechaFin: { gte: ahora } },
      { fechaFin: null, fechaInicio: { gte: ahora } },
    ],
  };
}

function filtroOrganizadorPublico(): Prisma.EventoWhereInput {
  return {
    OR: [
      { organizadorId: null },
      {
        organizador: {
          is: { especialidad: 'EVENTOS', estado: 'VERIFICADO', vetado: false },
        },
      },
    ],
  };
}

function filtroNegocioPublico(): Prisma.NegocioWhereInput {
  return {
    OR: [
      { organizadorId: null },
      {
        organizador: {
          is: {
            especialidad: 'GASTRONOMIA',
            estado: { not: 'SUSPENDIDO' },
            vetado: false,
          },
        },
      },
    ],
  };
}

const FILTROS_PUBLICOS = {
  estadoPublicacion: 'APROBADO',
  ...filtroOrganizadorPublico(),
} satisfies Prisma.EventoWhereInput;

const EVENTO_SELECT = {
  id: true,
  titulo: true,
  slug: true,
  descripcion: true,
  destacado: true,
  fechaInicio: true,
  fechaFin: true,
  horaApertura: true,
  direccion: true,
  precioReferencial: true,
  esMayorDeEdad: true,
  categoria: { select: { nombre: true } },
  lugar: { select: { nombre: true, direccion: true } },
  ciudad: { select: { nombre: true } },
  creadoEn: true,
} as const;

export class AiRepository {
  private async findIdsEventosPublicosPorTerminos(
    terminos: string[],
    limite: number,
    periodo?: PeriodoEventos,
    soloFinalizados = false,
    soloGratuitos = false,
    orden: 'proximos' | 'recomendados' | 'recientes' = 'proximos',
  ): Promise<number[] | null> {
    const palabras = terminos
      .filter((termino) => termino.length >= 3)
      .slice(0, 5);
    if (palabras.length === 0) return null;

    const condiciones: Prisma.Sql[] = palabras.map((termino) => {
      const patron = `%${termino}%`;
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
    condiciones.push(Prisma.sql`evento."estadoPublicacion" = 'APROBADO'`);
    condiciones.push(Prisma.sql`(
      evento."organizadorId" IS NULL
      OR (
        organizador."especialidad" = 'EVENTOS'
        AND organizador."estado" = 'VERIFICADO'
        AND organizador."vetado" = false
      )
    )`);
    if (periodo) {
      condiciones.push(Prisma.sql`evento."fechaInicio" < ${periodo.hasta}`);
      condiciones.push(Prisma.sql`(
        evento."fechaFin" >= ${periodo.desde}
        OR (
          evento."fechaFin" IS NULL
          AND evento."fechaInicio" >= ${periodo.desde}
        )
      )`);
      if (periodo.soloVigentes) {
        const ahora = new Date();
        condiciones.push(Prisma.sql`(
          evento."fechaFin" >= ${ahora}
          OR (
            evento."fechaFin" IS NULL
            AND evento."fechaInicio" >= ${ahora}
          )
        )`);
      }
    }
    if (soloFinalizados) {
      const ahora = new Date();
      condiciones.push(Prisma.sql`(
        evento."fechaFin" < ${ahora}
        OR (
          evento."fechaFin" IS NULL
          AND evento."fechaInicio" < ${ahora}
        )
      )`);
    }
    if (!periodo && !soloFinalizados) {
      const ahora = new Date();
      condiciones.push(Prisma.sql`(
        evento."fechaFin" >= ${ahora}
        OR (
          evento."fechaFin" IS NULL
          AND evento."fechaInicio" >= ${ahora}
        )
      )`);
    }
    if (soloGratuitos) {
      condiciones.push(Prisma.sql`evento."precioReferencial" = 0`);
    }
    const ordenSql = orden === 'recientes'
      ? Prisma.sql`evento."creadoEn" DESC`
      : orden === 'recomendados'
        ? Prisma.sql`evento."destacado" DESC, evento."fechaInicio" ASC`
        : Prisma.sql`evento."fechaInicio" ASC`;
    const filas = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT evento."id"
      FROM "Evento" AS evento
      LEFT JOIN "Categoria" AS categoria ON categoria."id" = evento."categoriaId"
      LEFT JOIN "Lugar" AS lugar ON lugar."id" = evento."lugarId"
      LEFT JOIN "Ciudad" AS ciudad ON ciudad."id" = evento."ciudadId"
      LEFT JOIN "Organizador" AS organizador ON organizador."id" = evento."organizadorId"
      WHERE ${Prisma.join(condiciones, ' AND ')}
      ORDER BY ${ordenSql}
      LIMIT ${limite}
    `;
    return filas.map((fila) => fila.id);
  }

  private async findEventosProximosFiltrados(
    terminos: string[],
    soloGratuitos: boolean,
    orden: 'proximos' | 'recomendados' | 'recientes',
    limite: number,
  ): Promise<EventoContexto[]> {
    const ids = await this.findIdsEventosPublicosPorTerminos(
      terminos,
      limite,
      undefined,
      false,
      soloGratuitos,
      orden,
    );
    if (ids?.length === 0) return [];
    return prisma.evento.findMany({
      where: { AND: [
        FILTROS_PUBLICOS,
        filtroFechaProximos(),
        ...(ids ? [{ id: { in: ids } }] : []),
        ...(soloGratuitos ? [{ precioReferencial: 0 }] : []),
      ] },
      select: EVENTO_SELECT,
      take: limite,
      orderBy: orden === 'recientes'
        ? { creadoEn: 'desc' }
        : orden === 'recomendados'
          ? [{ destacado: 'desc' }, { fechaInicio: 'asc' }]
          : { fechaInicio: 'asc' },
    });
  }

  async findEventosPorTerminos(
    terminos: string[],
    soloGratuitos = false,
    limite = 8,
  ): Promise<EventoContexto[]> {
    return this.findEventosProximosFiltrados(terminos, soloGratuitos, 'proximos', limite);
  }

  async findEventosRecomendados(
    terminos: string[] = [],
    soloGratuitos = false,
    limite = 10,
  ): Promise<EventoContexto[]> {
    return this.findEventosProximosFiltrados(terminos, soloGratuitos, 'recomendados', limite);
  }

  async findEventosRecientes(
    terminos: string[] = [],
    soloGratuitos = false,
    limite = 10,
  ): Promise<EventoContexto[]> {
    return this.findEventosProximosFiltrados(terminos, soloGratuitos, 'recientes', limite);
  }

  private async agregarCalificaciones(
    negocios: NegocioContexto[],
  ): Promise<NegocioContexto[]> {
    if (negocios.length === 0) return [];
    const calificaciones = await prisma.calificacionNegocio.groupBy({
      by: ['negocioId'],
      where: { negocioId: { in: negocios.map(({ id }) => id) } },
      _avg: { estrellas: true },
      _count: { _all: true },
    });
    const porNegocio = new Map(calificaciones.map((calificacion) => [
      calificacion.negocioId,
      {
        promedioEstrellas: calificacion._avg.estrellas,
        totalCalificaciones: calificacion._count._all,
      },
    ]));
    return negocios.map((negocio) => ({
      ...negocio,
      promedioEstrellas: porNegocio.get(negocio.id)?.promedioEstrellas ?? null,
      totalCalificaciones: porNegocio.get(negocio.id)?.totalCalificaciones ?? 0,
    }));
  }

  async findNegociosPublicados(incluirCalificaciones = false): Promise<NegocioContexto[]> {
    const negocios = await prisma.negocio.findMany({
      where: {
        estadoPublicacion: 'APROBADO',
        activo: true,
        ...filtroNegocioPublico(),
      },
      select: {
        id: true,
        slug: true,
        nombre: true,
        descripcion: true,
        direccion: true,
        telefono: true,
        whatsapp: true,
        horarioAtencion: true,
        categoria: true,
        precioPromedio: true,
        platos: true,
        ciudad: { select: { nombre: true } },
        creadoEn: true,
      },
      take: 100,
      orderBy: { creadoEn: 'desc' },
    });
    return incluirCalificaciones ? this.agregarCalificaciones(negocios) : negocios;
  }

  async findNegocioPublicadoPorSlug(
    slug: string,
    incluirCalificaciones = false,
  ): Promise<NegocioContexto | null> {
    const negocio = await prisma.negocio.findFirst({
      where: {
        slug,
        estadoPublicacion: 'APROBADO',
        activo: true,
        ...filtroNegocioPublico(),
      },
      select: {
        id: true,
        slug: true,
        nombre: true,
        descripcion: true,
        direccion: true,
        telefono: true,
        whatsapp: true,
        horarioAtencion: true,
        categoria: true,
        precioPromedio: true,
        platos: true,
        ciudad: { select: { nombre: true } },
        creadoEn: true,
      },
    });
    if (!negocio) return null;
    if (!incluirCalificaciones) return negocio;
    return (await this.agregarCalificaciones([negocio]))[0];
  }

  async findEventoById(id: number): Promise<EventoContexto | null> {
    return prisma.evento.findFirst({
      where: { id, ...FILTROS_PUBLICOS },
      select: EVENTO_SELECT,
    });
  }

  async findEventoPublicadoPorSlug(slug: string): Promise<EventoContexto | null> {
    return prisma.evento.findFirst({
      where: { slug, ...FILTROS_PUBLICOS },
      select: EVENTO_SELECT,
    });
  }

  async findProximos(limit = 15): Promise<EventoContexto[]> {
    return prisma.evento.findMany({
      where: {
        AND: [FILTROS_PUBLICOS, filtroFechaProximos()],
      },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findGratuitos(limit = 10): Promise<EventoContexto[]> {
    return prisma.evento.findMany({
      where: {
        AND: [
          FILTROS_PUBLICOS,
          filtroFechaProximos(),
          {
            OR: [
              { precioReferencial: 0 },
            ],
          },
        ],
      },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findPorCategoria(categoria: string, limit = 10): Promise<EventoContexto[]> {
    return prisma.evento.findMany({
      where: {
        AND: [
          FILTROS_PUBLICOS,
          filtroFechaProximos(),
          { categoria: { nombre: { contains: categoria, mode: 'insensitive' } } },
        ],
      },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findEventosEnPeriodo(
    periodo: PeriodoEventos,
    terminos: string[] = [],
    soloFinalizados = false,
    limit = 20,
    soloGratuitos = false,
  ): Promise<EventoContexto[]> {
    const ids = await this.findIdsEventosPublicosPorTerminos(
      terminos,
      limit,
      periodo,
      soloFinalizados,
      soloGratuitos,
    );
    if (ids?.length === 0) return [];

    const condiciones: Prisma.EventoWhereInput[] = [
      FILTROS_PUBLICOS,
      {
        fechaInicio: { lt: periodo.hasta },
        OR: [
          { fechaFin: { gte: periodo.desde } },
          { fechaFin: null, fechaInicio: { gte: periodo.desde } },
        ],
      },
      ...(ids ? [{ id: { in: ids } }] : []),
      ...(soloGratuitos ? [{ precioReferencial: 0 }] : []),
    ];

    if (periodo.soloVigentes) {
      const ahora = new Date();
      condiciones.push({
        OR: [
          { fechaFin: { gte: ahora } },
          { fechaFin: null, fechaInicio: { gte: ahora } },
        ],
      });
    }

    if (soloFinalizados) {
      const ahora = new Date();
      condiciones.push({
        OR: [
          { fechaFin: { lt: ahora } },
          { fechaFin: null, fechaInicio: { lt: ahora } },
        ],
      });
    }

    return prisma.evento.findMany({
      where: { AND: condiciones },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findFinalizados(limit = 15): Promise<EventoContexto[]> {
    const ahora = new Date();
    return prisma.evento.findMany({
      where: {
        AND: [
          FILTROS_PUBLICOS,
          {
            OR: [
              { fechaFin: { lt: ahora } },
              { fechaFin: null, fechaInicio: { lt: ahora } },
            ],
          },
        ],
      },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'desc' },
    });
  }
}