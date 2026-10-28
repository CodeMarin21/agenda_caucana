import { Prisma } from '@prisma/client';
import { IEstrategiaFiltro } from './IEstrategiaFiltro';

export class FiltroPorPrecio implements IEstrategiaFiltro {
  constructor(private precioMax: number) {}

  aplicar(): Prisma.EventoWhereInput {
    return {
      precioReferencial: {
        lte: this.precioMax,
      },
    };
  }
}