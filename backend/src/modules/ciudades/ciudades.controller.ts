import { Request, Response } from 'express';
import { CiudadesService } from './ciudades.service';

const service = new CiudadesService();

export const listarCiudades = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ciudades = await service.listarActivas();
    res.json(ciudades);
  } catch {
    res.status(500).json({ error: 'Error al obtener ciudades' });
  }
};

export const listarLugaresCiudad = async (req: Request, res: Response): Promise<void> => {
  try {
    const lugares = await service.listarLugares(parseInt(req.params.id));
    res.json(lugares);
  } catch {
    res.status(500).json({ error: 'Error al obtener lugares' });
  }
};

export const crearCiudad = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, departamento } = req.body as { nombre: string; departamento: string };
    const ciudad = await service.crearCiudad(nombre, departamento);
    res.status(201).json({ mensaje: 'Ciudad creada', ciudad });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear';
    res.status(400).json({ error: mensaje });
  }
};

export const crearLugar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, direccion, descripcion, capacidad } = req.body as {
      nombre: string;
      direccion: string;
      descripcion?: string;
      capacidad?: number;
    };
    const lugar = await service.crearLugar(
      parseInt(req.params.id),
      nombre,
      direccion,
      descripcion,
      capacidad
    );
    res.status(201).json({ mensaje: 'Lugar creado', lugar });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear lugar';
    res.status(400).json({ error: mensaje });
  }
};