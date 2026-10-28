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
  precioReferencial: true,
  esMayorDeEdad: true,
  urlExternaBoletas: true,
  categoria: { select: { nombre: true } },
  lugar: { select: { nombre: true, direccion: true } },
} as const;

export class AiRepository {
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