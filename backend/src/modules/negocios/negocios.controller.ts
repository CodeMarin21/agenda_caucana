import crypto from 'crypto';
import { Request, Response } from 'express';
import { CategoriaNegocio } from '@prisma/client';
import { NegociosService, PlatoDTO } from './negocios.service';
import { FiltrosNegocios } from './negocios.repository';

const service = new NegociosService();
const MAX_Q_LENGTH = 100;

function parsearId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function responderError(res: Response, error: unknown): void {
  const mensaje = error instanceof Error ? error.message : 'Error interno del servidor';
  const status = mensaje.includes('no encontrado')
    ? 404
    : mensaje.includes('Ya calificaste')
      ? 429
      : mensaje.includes('No tienes permiso') ||
        mensaje.includes('perfil de organizador') ||
        mensaje.includes('vetada')
        ? 403
        : 500;
  res.status(status).json({ error: mensaje });
}

export const listarNegocios = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const qRaw = query.q;
    const q = typeof qRaw === 'string' && qRaw.trim().length > 0
      ? qRaw.trim().slice(0, MAX_Q_LENGTH)
      : undefined;

    const filtros: FiltrosNegocios = {
      categoria: query.categoria as CategoriaNegocio | undefined,
      ciudadId: query.ciudadId ? Number(query.ciudadId) : undefined,
      precioMax: query.precioMax ? Number(query.precioMax) : undefined,
      orden: (query.orden as FiltrosNegocios['orden']) || 'recientes',
      pagina: query.pagina ? Number(query.pagina) : 1,
      limite: query.limite ? Number(query.limite) : 12,
      q,
    };
    res.json(await service.listarAprobados(filtros));
  } catch (error) {
    responderError(res, error);
  }
};

export const obtenerNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.obtenerPorSlug(req.params.slug));
  } catch (error) {
    responderError(res, error);
  }
};

export const crearNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const {
      nombre,
      descripcion,
      direccion,
      ciudadId,
      telefono,
      whatsapp,
      instagram,
      horarioAtencion,
      categoria,
      precioPromedio,
      imagenPrincipalUrl,
      imagenesAdicionales,
      platos,
    } = req.body as {
      nombre: string;
      descripcion: string;
      direccion: string;
      ciudadId: number;
      telefono?: string;
      whatsapp?: string;
      instagram?: string;
      horarioAtencion?: string;
      categoria: CategoriaNegocio;
      precioPromedio?: number;
      imagenPrincipalUrl?: string;
      imagenesAdicionales?: string[];
      platos?: PlatoDTO[];
    };

    const negocio = await service.crear({
      nombre,
      descripcion,
      direccion,
      ciudadId,
      telefono,
      whatsapp,
      instagram,
      horarioAtencion,
      categoria,
      precioPromedio,
      imagenPrincipalUrl,
      imagenesAdicionales,
      platos,
    }, req.usuarioId);

    res.status(201).json({
      mensaje: negocio.estadoPublicacion === 'APROBADO'
        ? 'Negocio creado y publicado'
        : 'Negocio enviado para revisión',
      negocio,
    });
  } catch (error) {
    responderError(res, error);
  }
};

export const misNegocios = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    res.json({ negocios: await service.misNegocios(req.usuarioId) });
  } catch (error) {
    responderError(res, error);
  }
};

export const eliminarNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parsearId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de negocio inválido' });
      return;
    }
    const esAdmin = req.rol === 'ADMIN';
    const motivoBody = (req.body as { motivo?: unknown } | undefined)?.motivo;
    if (motivoBody !== undefined && typeof motivoBody !== 'string') {
      res.status(400).json({ error: 'El motivo debe ser texto' });
      return;
    }
    if (esAdmin && (typeof motivoBody !== 'string' || motivoBody.trim().length < 5)) {
      res.status(400).json({ error: 'Debes indicar el motivo para eliminar el negocio.' });
      return;
    }
    if (typeof motivoBody === 'string' && motivoBody.trim().length < 5) {
      res.status(400).json({ error: 'El motivo debe tener al menos 5 caracteres' });
      return;
    }

    const motivo = typeof motivoBody === 'string'
      ? motivoBody.trim()
      : 'Eliminado por el organizador.';
    await service.eliminar(id, req.usuarioId, esAdmin, motivo);
    res.json({ mensaje: 'Negocio eliminado' });
  } catch (error) {
    responderError(res, error);
  }
};

export const listarTodos = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.listarTodos());
  } catch (error) {
    responderError(res, error);
  }
};

export const listarPendientes = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.listarPendientes());
  } catch (error) {
    responderError(res, error);
  }
};

export const aprobarNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parsearId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de negocio inválido' });
      return;
    }
    const negocio = await service.aprobar(id);
    res.json({ mensaje: 'Negocio aprobado', negocio });
  } catch (error) {
    responderError(res, error);
  }
};

export const rechazarNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parsearId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de negocio inválido' });
      return;
    }
    const { motivo } = req.body as { motivo?: unknown };
    if (typeof motivo !== 'string' || motivo.trim().length < 5) {
      res.status(400).json({ error: 'Debes indicar el motivo (mínimo 5 caracteres)' });
      return;
    }
    const negocio = await service.rechazar(id, motivo);
    res.json({ mensaje: 'Negocio rechazado', negocio });
  } catch (error) {
    responderError(res, error);
  }
};

export const destacarNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parsearId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de negocio inválido' });
      return;
    }
    const { destacado } = req.body as { destacado?: unknown };
    if (typeof destacado !== 'boolean') {
      res.status(400).json({ error: 'El campo destacado debe ser booleano' });
      return;
    }
    const negocio = await service.destacar(id, destacado);
    res.json({ mensaje: 'Negocio actualizado', negocio });
  } catch (error) {
    responderError(res, error);
  }
};

export const calificarNegocio = async (req: Request, res: Response): Promise<void> => {
  try {
    const negocioId = parsearId(req.params.id);
    if (!negocioId) {
      res.status(400).json({ error: 'ID de negocio inválido' });
      return;
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = (typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : '') || req.ip || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const { estrellas, comentario } = req.body as {
      estrellas: number;
      comentario?: string;
    };
    const calificacion = await service.calificar(
      negocioId,
      ipHash,
      estrellas,
      comentario
    );
    res.status(201).json({ mensaje: 'Calificación registrada', calificacion });
  } catch (error) {
    responderError(res, error);
  }
};
