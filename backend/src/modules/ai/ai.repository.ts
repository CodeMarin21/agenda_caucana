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

function filtroTerminos(terminos: string[]): Prisma.EventoWhereInput[] {
  return terminos
    .filter((termino) => termino.length >= 3)
    .slice(0, 5)
    .map((termino) => ({
      OR: [
        { titulo: { contains: termino, mode: 'insensitive' } },
        { descripcion: { contains: termino, mode: 'insensitive' } },
        { categoria: { is: { nombre: { contains: termino, mode: 'insensitive' } } } },
        { lugar: { is: { nombre: { contains: termino, mode: 'insensitive' } } } },
        { ciudad: { is: { nombre: { contains: termino, mode: 'insensitive' } } } },
      ],
    }));
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
  fechaInicio: true,
  fechaFin: true,
  horaApertura: true,
  direccion: true,
  precioReferencial: true,
  esMayorDeEdad: true,
  categoria: { select: { nombre: true } },
  lugar: { select: { nombre: true, direccion: true } },
  ciudad: { select: { nombre: true } },
} as const;

export class AiRepository {
  async findEventosPorTerminos(terminos: string[]): Promise<EventoContexto[]> {
    const palabras = filtroTerminos(terminos);
    if (palabras.length === 0) return [];

    return prisma.evento.findMany({
      where: {
        ...FILTROS_PUBLICOS,
        AND: palabras,
      },
      select: EVENTO_SELECT,
      take: 8,
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findNegociosPublicados(): Promise<NegocioContexto[]> {
    return prisma.negocio.findMany({
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
      },
      take: 100,
      orderBy: { creadoEn: 'desc' },
    });
  }

  async findNegocioPublicadoPorSlug(slug: string): Promise<NegocioContexto | null> {
    return prisma.negocio.findFirst({
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
      },
    });
  }

  async findEventoById(id: number): Promise<EventoContexto | null> {
    return prisma.evento.findFirst({
      where: { id, ...FILTROS_PUBLICOS },
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
              { precioReferencial: null },
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
  ): Promise<EventoContexto[]> {
    const condiciones: Prisma.EventoWhereInput[] = [
      FILTROS_PUBLICOS,
      {
        fechaInicio: { lt: periodo.hasta },
        OR: [
          { fechaFin: { gte: periodo.desde } },
          { fechaFin: null, fechaInicio: { gte: periodo.desde } },
        ],
      },
      ...filtroTerminos(terminos),
    ];

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