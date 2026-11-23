import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { NotificacionesRepository } from './notificaciones.repository';

const repo = new NotificacionesRepository();
const LIMITE_MAXIMO = 50;

function enteroPositivo(value: unknown): number | null {
  const texto = String(value ?? '');
  if (!/^[1-9]\d*$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : null;
}

export async function listarNotificaciones(req: Request, res: Response): Promise<void> {
  const pagina = req.query.pagina === undefined ? 1 : enteroPositivo(req.query.pagina);
  const limite = req.query.limite === undefined ? 20 : enteroPositivo(req.query.limite);
  if (pagina === null || limite === null || limite > LIMITE_MAXIMO) {
    res.status(400).json({ error: `La página debe ser positiva y el límite estar entre 1 y ${LIMITE_MAXIMO}.` });
    return;
  }

  try {
    res.json(await repo.listarPorUsuario(req.usuarioId!, pagina, limite));
  } catch (error) {
    logger.error({
      mensaje: 'No se pudieron cargar las notificaciones',
      usuarioId: req.usuarioId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' });
  }
}

export async function marcarNotificacionLeida(req: Request, res: Response): Promise<void> {
  const id = enteroPositivo(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'El identificador de la notificación no es válido.' });
    return;
  }

  try {
    const actualizada = await repo.marcarLeida(req.usuarioId!, id);
    if (!actualizada) {
      res.status(404).json({ error: 'La notificación no existe o ya fue leída.' });
      return;
    }
    res.json({ mensaje: 'Notificación marcada como leída.' });
  } catch (error) {
    logger.error({
      mensaje: 'No se pudo marcar la notificación como leída',
      usuarioId: req.usuarioId,
      notificacionId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'No se pudo actualizar la notificación.' });
  }
}

export async function marcarTodasLeidas(req: Request, res: Response): Promise<void> {
  try {
    const marcadas = await repo.marcarTodasLeidas(req.usuarioId!);
    res.json({ mensaje: 'Notificaciones actualizadas.', marcadas });
  } catch (error) {
    logger.error({
      mensaje: 'No se pudieron marcar todas las notificaciones como leídas',
      usuarioId: req.usuarioId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'No se pudieron actualizar las notificaciones.' });
  }
}
