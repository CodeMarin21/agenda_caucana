import { prisma } from '../../config/database';

export class CategoriasService {

  async listarActivas() {
    return prisma.categoria.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        descripcion: true,
        icono: true,
        _count: { select: { eventos: true } },
      },
    });
  }

  async crear(nombre: string, descripcion?: string, icono?: string) {
    const slug = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const existe = await prisma.categoria.findUnique({ where: { slug } });
    if (existe) throw new Error('Ya existe una categoría con ese nombre');

    return prisma.categoria.create({
      data: { nombre, slug, descripcion, icono },
    });
  }

  async desactivar(id: number) {
    const categoria = await prisma.categoria.findUnique({ where: { id } });
    if (!categoria) throw new Error('Categoría no encontrada');

    return prisma.categoria.update({
      where: { id },
      data: { activa: false },
    });
  }
}