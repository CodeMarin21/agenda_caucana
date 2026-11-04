import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { EventoContexto } from './ai.types';

function filtroFechaProximos(): Prisma.EventoWhereInput {
  const ahora = new Date();
  return {
    OR: [
      { fechaFin: { gte: ahora } },
      { fechaFin: null, fechaInicio: { gte: ahora } },
    ],
  };
}

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
  urlExternaBoletas: true,
  categoria: { select: { nombre: true } },
  lugar: { select: { nombre: true, direccion: true } },
  ciudad: { select: { nombre: true } },
} as const;

export class AiRepository {
  async findEventosPorTerminos(terminos: string[]): Promise<EventoContexto[]> {
    const palabras = terminos.filter((termino) => termino.length >= 3).slice(0, 5);
    if (palabras.length === 0) return [];

    return prisma.evento.findMany({
      where: {
        estadoPublicacion: 'APROBADO',
        OR: [
          { organizadorId: null },
          { organizador: { is: { estado: 'VERIFICADO', vetado: false } } },
        ],
        AND: palabras.map((termino) => ({
          OR: [
            { titulo: { contains: termino, mode: 'insensitive' } },
            { descripcion: { contains: termino, mode: 'insensitive' } },
            { categoria: { is: { nombre: { contains: termino, mode: 'insensitive' } } } },
            { lugar: { is: { nombre: { contains: termino, mode: 'insensitive' } } } },
            { ciudad: { is: { nombre: { contains: termino, mode: 'insensitive' } } } },
          ],
        })),
      },
      select: EVENTO_SELECT,
      take: 8,
      orderBy: { fechaInicio: 'desc' },
    });
  }

  async findNegociosPublicados(): Promise<import('./ai.types').NegocioContexto[]> {
    return prisma.negocio.findMany({
      where: {
        estadoPublicacion: 'APROBADO',
        activo: true,
        OR: [
          { organizadorId: null },
          { organizador: { is: { estado: 'VERIFICADO', vetado: false } } },
        ],
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

  async findEventoById(id: number): Promise<EventoContexto | null> {
    return prisma.evento.findFirst({
      where: { id, estadoPublicacion: 'APROBADO' },
      select: EVENTO_SELECT,
    });
  }

  async findProximos(limit = 15): Promise<EventoContexto[]> {
    return prisma.evento.findMany({
      where: {
        estadoPublicacion: 'APROBADO',
        ...filtroFechaProximos(),
      },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
    });
  }

  async findGratuitos(limit = 10): Promise<EventoContexto[]> {
    return prisma.evento.findMany({
      where: {
        estadoPublicacion: 'APROBADO',
        AND: [
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
        estadoPublicacion: 'APROBADO',
        ...filtroFechaProximos(),
        categoria: { nombre: { contains: categoria, mode: 'insensitive' } },
      },
      select: EVENTO_SELECT,
      take: limit,
      orderBy: { fechaInicio: 'asc' },
    });
  }
}