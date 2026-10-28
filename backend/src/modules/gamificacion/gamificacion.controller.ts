import { Request, Response } from 'express';
import { GamificacionService } from './gamificacion.service';
import { PrivacidadService } from './privacidad.service';
import { SeguidoresService } from './seguidores.service';

const svc = new GamificacionService();
const privacidadSvc = new PrivacidadService();
const seguidoresSvc = new SeguidoresService();

// ─────────────────────────────────────────────
// Rutas
// ─────────────────────────────────────────────

// GET /api/gamificacion/rutas
export async function listarRutas(req: Request, res: Response): Promise<void> {
  try {
    const rutas = await svc.listarRutasConProgreso(req.usuarioId!);
    res.json({ rutas });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al listar rutas';
    res.status(400).json({ error: mensaje });
  }
}

// GET /api/gamificacion/rutas/:id
export async function detalleRuta(req: Request, res: Response): Promise<void> {
  try {
    const rutaId = Number(req.params.id);
    if (!Number.isInteger(rutaId) || rutaId <= 0) {
      res.status(400).json({ error: 'ID de ruta inválido' });
      return;
    }
    const ruta = await svc.detalleRuta(req.usuarioId!, rutaId);
    res.json(ruta);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al obtener la ruta';
    res.status(404).json({ error: mensaje });
  }
}

// POST /api/gamificacion/visitas
export async function registrarVisita(req: Request, res: Response): Promise<void> {
  try {
    const { lugarId, latitud, longitud, accuracy } = req.body as {
      lugarId: number;
      latitud: number;
      longitud: number;
      accuracy?: number;
    };

    const jugadorId = await svc.obtenerJugadorIdPorUsuario(req.usuarioId!);
    if (!jugadorId) {
      res.status(403).json({ error: 'Solo los jugadores pueden registrar visitas' });
      return;
    }

    const resultado = await svc.registrarVisita({
      jugadorId,
      lugarId,
      coordenada: { latitud, longitud, accuracy },
    });

    res.status(201).json({
      mensaje: '¡Visita registrada!',
      ...resultado,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al registrar la visita';
    res.status(400).json({ error: mensaje });
  }
}

// GET /api/gamificacion/logros
export async function listarLogros(req: Request, res: Response): Promise<void> {
  try {
    const logros = await svc.listarLogros(req.usuarioId!);
    res.json({ logros });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al listar logros';
    res.status(400).json({ error: mensaje });
  }
}

// GET /api/gamificacion/perfil
export async function obtenerPerfil(req: Request, res: Response): Promise<void> {
  try {
    const perfil = await svc.obtenerPerfil(req.usuarioId!);
    res.json(perfil);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al obtener el perfil';
    res.status(400).json({ error: mensaje });
  }
}

// PATCH /api/gamificacion/perfil
export async function actualizarPerfil(req: Request, res: Response): Promise<void> {
  try {
    const { avatarUrl, descripcion } = req.body as {
      avatarUrl?: string;
      descripcion?: string;
    };
    const perfil = await svc.actualizarPerfil(req.usuarioId!, { avatarUrl, descripcion });
    res.json({ mensaje: 'Perfil actualizado correctamente', perfil });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar el perfil';
    res.status(400).json({ error: mensaje });
  }
}

// ─────────────────────────────────────────────
// Leaderboards y Hall of Fame (Públicos)
// ─────────────────────────────────────────────

// GET /api/gamificacion/leaderboard/semanal
export async function leaderboardSemanal(_req: Request, res: Response): Promise<void> {
  try {
    const top = await svc.obtenerLeaderboardSemanal();
    res.json({
      ciclo: 'semanal',
      reinicia: 'Domingos 12:00 PM (Bogotá)',
      top,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener el leaderboard semanal' });
  }
}

// GET /api/gamificacion/leaderboard/temporada
export async function leaderboardTemporada(_req: Request, res: Response): Promise<void> {
  try {
    const top = await svc.obtenerLeaderboardTemporada();
    res.json({
      ciclo: 'temporada',
      reinicia: 'Primer domingo del mes a las 12:05 PM (Bogotá)',
      top,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener el leaderboard de temporada' });
  }
}

// GET /api/gamificacion/hall-of-fame
export async function hallOfFame(_req: Request, res: Response): Promise<void> {
  try {
    const temporadas = await svc.listarTemporadasCerradas();
    res.json({
      temporadas: temporadas.map((t) => ({
        id: t.id,
        numero: t.numero,
        nombre: t.nombre,
        fechaInicio: t.fechaInicio,
        fechaFin: t.fechaFin,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener el Hall of Fame' });
  }
}

// GET /api/gamificacion/hall-of-fame/:temporadaId
export async function hallOfFameDetalle(req: Request, res: Response): Promise<void> {
  try {
    const temporadaId = Number(req.params.temporadaId);
    if (!Number.isInteger(temporadaId) || temporadaId <= 0) {
      res.status(400).json({ error: 'ID de temporada inválido' });
      return;
    }
    const data = await svc.obtenerHallOfFame(temporadaId);
    res.json(data);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al obtener el Hall of Fame';
    res.status(404).json({ error: mensaje });
  }
}

// ─────────────────────────────────────────────
// Privacidad del jugador
// ─────────────────────────────────────────────

// GET /api/gamificacion/perfil/privacidad
export async function obtenerPrivacidad(req: Request, res: Response): Promise<void> {
  try {
    const config = await privacidadSvc.obtener(req.usuarioId!);
    res.json(config);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al obtener privacidad';
    const status = mensaje === 'Jugador no encontrado' ? 404 : 400;
    res.status(status).json({ error: mensaje });
  }
}

// PATCH /api/gamificacion/perfil/privacidad
export async function actualizarPrivacidad(req: Request, res: Response): Promise<void> {
  try {
    const config = await privacidadSvc.actualizar(req.usuarioId!, req.body);
    res.json({ mensaje: 'Privacidad actualizada', configuracion: config });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar privacidad';
    const status = mensaje === 'Jugador no encontrado' ? 404 : 400;
    res.status(status).json({ error: mensaje });
  }
}

// ─────────────────────────────────────────────
// Seguimiento (Follow)
// ─────────────────────────────────────────────

// GET /api/gamificacion/seguidores?tipo=seguidores|siguiendo&page=1
export async function listarSeguidores(req: Request, res: Response): Promise<void> {
  try {
    const tipo = (req.query.tipo as string) || 'seguidores';
    const page = Number(req.query.page) || 1;
    const data = await seguidoresSvc.listar(
      req.usuarioId!,
      tipo as 'seguidores' | 'siguiendo',
      page
    );
    res.json(data);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al listar';
    res.status(400).json({ error: mensaje });
  }
}

// POST /api/gamificacion/seguir/:usuarioId
export async function seguir(req: Request, res: Response): Promise<void> {
  try {
    const objetivoId = Number(req.params.usuarioId);
    if (!Number.isInteger(objetivoId) || objetivoId <= 0) {
      res.status(400).json({ error: 'usuarioId inválido' });
      return;
    }
    const resultado = await seguidoresSvc.seguir(req.usuarioId!, objetivoId);
    res.status(201).json(resultado);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al seguir';
    const status = mensaje === 'Usuario no encontrado' ? 404 : 400;
    res.status(status).json({ error: mensaje });
  }
}

// DELETE /api/gamificacion/seguir/:usuarioId
export async function dejarDeSeguir(req: Request, res: Response): Promise<void> {
  try {
    const objetivoId = Number(req.params.usuarioId);
    if (!Number.isInteger(objetivoId) || objetivoId <= 0) {
      res.status(400).json({ error: 'usuarioId inválido' });
      return;
    }
    const resultado = await seguidoresSvc.dejarDeSeguir(req.usuarioId!, objetivoId);
    res.json(resultado);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al dejar de seguir';
    res.status(400).json({ error: mensaje });
  }
}