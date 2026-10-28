import { Prisma } from '@prisma/client';
import { IEstrategiaFiltro } from './IEstrategiaFiltro';

export class FiltroPorCategoria implements IEstrategiaFiltro {
  constructor(private categoriaSlug: string) {}

  aplicar(): Prisma.EventoWhereInput {
    return {
      categoria: { slug: this.categoriaSlug },
    };
  }
}