import { Prisma } from '@prisma/client';
import { IEstrategiaFiltro } from './IEstrategiaFiltro';

export class FiltroPorPrecio implements IEstrategiaFiltro {
  constructor(
    private precioMin?: number,
    private precioMax?: number,
  ) {}

  aplicar(): Prisma.EventoWhereInput {
    const precioReferencial = {
      ...(this.precioMin !== undefined ? { gte: this.precioMin } : {}),
      ...(this.precioMax !== undefined ? { lte: this.precioMax } : {}),
    };
    const filtroPrecio: Prisma.EventoWhereInput = { precioReferencial };
    return this.precioMin === undefined || this.precioMin === 0
      ? { OR: [filtroPrecio, { precioReferencial: null }] }
      : filtroPrecio;
  }
}