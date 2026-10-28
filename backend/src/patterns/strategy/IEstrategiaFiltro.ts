import { Prisma } from '@prisma/client';

export interface IEstrategiaFiltro {
  aplicar(): Prisma.EventoWhereInput;
}