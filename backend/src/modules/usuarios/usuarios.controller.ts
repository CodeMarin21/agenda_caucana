import { Request, Response } from 'express';
import { UsuariosService } from './usuarios.service';

const service = new UsuariosService();

export const suscribirse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, categoriaId } = req.body as { email: string; categoriaId: number };
    await service.suscribirse(email, categoriaId);
    res.status(201).json({ mensaje: '¡Suscrito! Te notificaremos cuando haya nuevos eventos.' });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al suscribirse';
    res.status(400).json({ error: mensaje });
  }
};

export const cancelarSuscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, categoriaId } = req.body as { email: string; categoriaId: number };
    await service.cancelarSuscripcion(email, categoriaId);
    res.json({ mensaje: 'Suscripción cancelada' });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al cancelar';
    res.status(400).json({ error: mensaje });
  }
};