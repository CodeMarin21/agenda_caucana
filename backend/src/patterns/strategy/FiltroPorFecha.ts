import { Prisma } from '@prisma/client';
import { IEstrategiaFiltro } from './IEstrategiaFiltro';

export class FiltroPorFecha implements IEstrategiaFiltro {
  constructor(private desde: Date, private hasta: Date) {}

  aplicar(): Prisma.EventoWhereInput {
    return {
      fechaInicio: {
        gte: this.desde,
        lte: this.hasta,
      },
    };
  }
}