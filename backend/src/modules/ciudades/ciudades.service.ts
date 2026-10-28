import { prisma } from '../../config/database';

export class CiudadesService {

  async listarActivas() {
    return prisma.ciudad.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        departamento: true,
        _count: { select: { eventos: true } },
      },
    });
  }

  async listarLugares(ciudadId: number) {
    return prisma.lugar.findMany({
      where: { ciudadId, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearCiudad(nombre: string, departamento: string) {
    const existe = await prisma.ciudad.findUnique({ where: { nombre } });
    if (existe) throw new Error('Ya existe una ciudad con ese nombre');

    return prisma.ciudad.create({
      data: { nombre, departamento },
    });
  }

  async crearLugar(
    ciudadId: number,
    nombre: string,
    direccion: string,
    descripcion?: string,
    capacidad?: number
  ) {
    const ciudad = await prisma.ciudad.findUnique({ where: { id: ciudadId } });
    if (!ciudad) throw new Error('Ciudad no encontrada');

    return prisma.lugar.create({
      data: { nombre, direccion, descripcion, capacidad, ciudadId },
    });
  }
}