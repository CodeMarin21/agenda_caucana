import { Request, Response } from 'express';
import { EventosService } from './eventos.service';
import { prisma } from '../../config/database';

const service = new EventosService();

// ─── Helper interno ─────────────────────────────────────
// Deriva el organizadorId desde el JWT autenticado.
// NUNCA se acepta organizadorId del body — eso permitiría
// que un organizador publique en nombre de otro (spoofing).
async function resolverOrganizadorDeJWT(
  usuarioId: number
): Promise<{ id: number; estado: string; vetado: boolean } | null> {
  return prisma.organizador.findUnique({
    where: { usuarioId },
    select: { id: true, estado: true, vetado: true },
  });
}

// ─── Listado público ────────────────────────────────────
export const listarEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoriaSlug, desde, hasta, precioMax, pagina, limite } = req.query as {
      categoriaSlug?: string;
      desde?: string;
      hasta?: string;
      precioMax?: string;
      pagina?: string;
      limite?: string;
    };

    const resultado = await service.listarAprobados({
      categoriaSlug,
      desde,
      hasta,
      precioMax: precioMax ? parseFloat(precioMax) : undefined,
      pagina:    pagina    ? parseInt(pagina)       : 1,
      limite:    limite    ? parseInt(limite)        : 12,
    });

    res.json(resultado);
  } catch {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

// ─── Detalle público ────────────────────────────────────
export const obtenerEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const evento = await service.obtenerPorSlug(req.params.slug);
    res.json(evento);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error';
    res.status(404).json({ error: mensaje });
  }
};

// ─── Solo ADMIN ─────────────────────────────────────────
export const listarTodos = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.listarTodos());
  } catch {
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

export const listarPendientes = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.listarPendientes());
  } catch {
    res.status(500).json({ error: 'Error al obtener pendientes' });
  }
};

// ─── Crear evento (ORGANIZADOR) ─────────────────────────
export const crearEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    // ── Whitelist: solo se aceptan estos campos del body.
    //    Cualquier campo extra (incluido organizadorId) es IGNORADO.
    const {
      titulo,
      descripcion,
      imagenUrl,
      publicIdImagen,
      fechaInicio,
      fechaFin,
      horaApertura,
      horaCierre,
      direccion,
      precioReferencial,
      esMayorDeEdad,
      urlExternaBoletas,
      gestionaTaquillaInterna,
      categoriaId,
      lugarId: lugarIdBody,
      ciudadId,
      lugarTexto,
    } = req.body as {
      titulo: string;
      descripcion: string;
      imagenUrl?: string;
      publicIdImagen?: string;
      fechaInicio: string;
      fechaFin?: string;
      horaApertura?: string;
      horaCierre?: string;
      direccion?: string;
      precioReferencial?: number;
      esMayorDeEdad?: boolean;
      urlExternaBoletas?: string;
      gestionaTaquillaInterna?: boolean;
      categoriaId: number;
      lugarId?: number;
      ciudadId: number;
      lugarTexto?: unknown;
    };
    let lugarId = lugarIdBody;
    let lugarTextoNormalizado: string | undefined;

    // ── Validaciones mínimas ──
    if (!titulo?.trim() || titulo.length < 5) {
      res.status(400).json({ error: 'El título debe tener al menos 5 caracteres' });
      return;
    }
    if (!descripcion?.trim() || descripcion.length < 10) {
      res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres' });
      return;
    }
    if (!fechaInicio) {
      res.status(400).json({ error: 'La fecha de inicio es obligatoria' });
      return;
    }
    if (lugarTexto !== undefined) {
      if (typeof lugarTexto !== 'string') {
        res.status(400).json({ error: 'El nombre del lugar debe tener entre 3 y 150 caracteres' });
        return;
      }
      lugarTextoNormalizado = lugarTexto.trim();
      if (lugarTextoNormalizado.length < 3 || lugarTextoNormalizado.length > 150) {
        res.status(400).json({ error: 'El nombre del lugar debe tener entre 3 y 150 caracteres' });
        return;
      }
    }
    if (!categoriaId || !ciudadId || (!lugarId && !lugarTextoNormalizado)) {
      res.status(400).json({ error: 'Categoría, ciudad y lugar o nombre del lugar son obligatorios' });
      return;
    }

    // ── Resolver organizadorId ──
    // El organizadorId SIEMPRE sale del JWT, nunca del body.
    let organizadorId: number | undefined;
    let organizadorEstado: string | undefined;

    if (req.rol !== 'ORGANIZADOR') {
      res.status(403).json({ error: 'Solo organizadores pueden crear eventos' });
      return;
    }
    const organizador = await resolverOrganizadorDeJWT(req.usuarioId!);
    if (!organizador) {
      res.status(403).json({ error: 'No tienes perfil de organizador' });
      return;
    }
    if (organizador.vetado || organizador.estado !== 'VERIFICADO') {
      res.status(403).json({
        error: organizador.vetado
          ? 'Tu cuenta está vetada y no puede publicar eventos.'
          : organizador.estado === 'SUSPENDIDO'
            ? 'Tu cuenta está suspendida. Contacta al administrador.'
            : 'Tu cuenta aún no está verificada para publicar eventos.',
      });
      return;
    }
    organizadorId = organizador.id;
    organizadorEstado = organizador.estado;

    if (!lugarId && lugarTextoNormalizado) {
      const lugar = await prisma.lugar.create({
        data: {
          nombre: lugarTextoNormalizado,
          direccion: direccion?.trim() || 'Popayán, Cauca',
          ciudadId,
          activo: true,
        },
      });
      lugarId = lugar.id;
    }
    if (!lugarId) {
      res.status(400).json({ error: 'Debes seleccionar o indicar un lugar' });
      return;
    }

    const evento = await service.crear({
      titulo,
      descripcion,
      imagenUrl,
      publicIdImagen,
      fechaInicio,
      fechaFin,
      horaApertura,
      horaCierre,
      direccion,
      precioReferencial,
      esMayorDeEdad,
      urlExternaBoletas,
      gestionaTaquillaInterna,
      categoriaId,
      lugarId,
      ciudadId,
      organizadorId,   // ← derivado del JWT
      organizadorEstado,
    });

    res.status(201).json({
      mensaje: organizadorEstado === 'VERIFICADO'
        ? 'Evento creado y publicado'
        : 'Evento enviado — quedará pendiente de aprobación',
      evento,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear evento';
    res.status(400).json({ error: mensaje });
  }
};

// ─── Aprobar / rechazar (ADMIN) ─────────────────────────
export const aprobarEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const evento = await service.aprobar(parseInt(req.params.id));
    res.json({ mensaje: 'Evento aprobado y notificaciones enviadas', evento });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al aprobar';
    res.status(400).json({ error: mensaje });
  }
};

export const rechazarEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { motivo } = req.body as { motivo: string };
    if (!motivo?.trim() || motivo.length < 5) {
      res.status(400).json({ error: 'Debes indicar el motivo (mínimo 5 caracteres)' });
      return;
    }
    const evento = await service.rechazar(parseInt(req.params.id), motivo);
    res.json({ mensaje: 'Evento rechazado', evento });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al rechazar';
    res.status(400).json({ error: mensaje });
  }
};

// ─── Destacar (ADMIN) ────────────────────────────────────
export const destacarEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { destacado } = req.body as { destacado?: unknown };
    if (typeof destacado !== 'boolean') {
      res.status(400).json({ error: 'El campo destacado debe ser booleano' });
      return;
    }
    const evento = await service.destacar(id, destacado);
    res.json({ mensaje: 'Evento actualizado', evento });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar el evento';
    res.status(mensaje === 'Evento no encontrado' ? 404 : 400).json({ error: mensaje });
  }
};

// ─── Eliminar (ADMIN cualquiera, ORGANIZADOR solo el suyo) ──
export const eliminarEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const esAdmin = req.rol === 'ADMIN';

    const evento = await prisma.evento.findUnique({
      where: { id },
      select: { organizadorId: true },
    });
    if (!evento) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    if (!esAdmin) {
      const organizador = await resolverOrganizadorDeJWT(req.usuarioId!);
      if (!organizador || evento.organizadorId !== organizador.id) {
        res.status(403).json({ error: 'No tienes permiso para eliminar este evento' });
        return;
      }
    }

    const motivoBody = (req.body as { motivo?: unknown } | undefined)?.motivo;
    if (motivoBody !== undefined && typeof motivoBody !== 'string') {
      res.status(400).json({ error: 'El motivo debe ser texto' });
      return;
    }
    if (esAdmin && (typeof motivoBody !== 'string' || motivoBody.trim().length < 5)) {
      res.status(400).json({ error: 'Debes indicar el motivo para eliminar el evento.' });
      return;
    }
    if (typeof motivoBody === 'string' && motivoBody.trim().length < 5) {
      res.status(400).json({ error: 'El motivo debe tener al menos 5 caracteres' });
      return;
    }

    const motivo = typeof motivoBody === 'string'
      ? motivoBody.trim()
      : 'Eliminado por el organizador.';
    await service.eliminar(id, motivo);
    res.json({ mensaje: 'Evento eliminado' });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al eliminar';
    res.status(mensaje === 'Evento no encontrado' ? 404 : 500).json({ error: mensaje });
  }
};

// ─── Mis eventos (ORGANIZADOR) ─────────────────────────
export const misEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.rol !== 'ORGANIZADOR') {
      res.status(403).json({ error: 'Solo organizadores tienen acceso' });
      return;
    }
    const organizador = await resolverOrganizadorDeJWT(req.usuarioId!);
    if (!organizador) {
      res.status(403).json({ error: 'No tienes perfil de organizador' });
      return;
    }

    const eventos = await prisma.evento.findMany({
      where: { organizadorId: organizador.id },
      include: {
        categoria: { select: { nombre: true, slug: true } },
        lugar:     { select: { nombre: true, direccion: true } },
        ciudad:    { select: { nombre: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.json({ eventos });
  } catch {
    res.status(500).json({ error: 'Error al obtener tus eventos' });
  }
};