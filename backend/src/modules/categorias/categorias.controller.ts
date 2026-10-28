import { Request, Response } from 'express';
import { CategoriasService } from './categorias.service';

const service = new CategoriasService();

export const listarCategorias = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categorias = await service.listarActivas();
    res.json(categorias);
  } catch {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const crearCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, descripcion, icono } = req.body as {
      nombre: string;
      descripcion?: string;
      icono?: string;
    };
    const categoria = await service.crear(nombre, descripcion, icono);
    res.status(201).json({ mensaje: 'Categoría creada', categoria });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear';
    res.status(400).json({ error: mensaje });
  }
};

export const eliminarCategoria = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.desactivar(parseInt(req.params.id));
    res.json({ mensaje: 'Categoría desactivada' });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error';
    res.status(404).json({ error: mensaje });
  }
};