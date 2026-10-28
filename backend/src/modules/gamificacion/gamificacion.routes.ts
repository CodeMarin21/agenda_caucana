import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { Rol } from '@prisma/client';
import {
  listarRutas,
  detalleRuta,
  registrarVisita,
  listarLogros,
  obtenerPerfil,
  actualizarPerfil,
  leaderboardSemanal,
  leaderboardTemporada,
  hallOfFame,
  hallOfFameDetalle,
  obtenerPrivacidad,
  actualizarPrivacidad,
  listarSeguidores,
  seguir,
  dejarDeSeguir,
} from './gamificacion.controller';
import {
  checkinValidacion,
  actualizarPerfilValidacion,
  actualizarPrivacidadValidacion,
} from './gamificacion.dto';

const router = Router();

// ── Rate limits ──────────────────────────────────────────
const checkinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiados check-ins. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas consultas. Espera un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const followLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas acciones de seguimiento. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Público ──────────────────────────────────────────────
router.get('/leaderboard/semanal',       publicLimiter, leaderboardSemanal);
router.get('/leaderboard/temporada',     publicLimiter, leaderboardTemporada);
router.get('/hall-of-fame',              publicLimiter, hallOfFame);
router.get('/hall-of-fame/:temporadaId', publicLimiter, hallOfFameDetalle);

// ── Solo JUGADOR ─────────────────────────────────────────
const soloJugador = [authMiddleware, requireRole(Rol.JUGADOR)];

router.get('/rutas',     soloJugador, listarRutas);
router.get('/rutas/:id', soloJugador, detalleRuta);
router.get('/logros',    soloJugador, listarLogros);
router.get('/perfil',    soloJugador, obtenerPerfil);

router.patch(
  '/perfil',
  ...soloJugador,
  actualizarPerfilValidacion,
  validateRequest,
  actualizarPerfil
);

router.post(
  '/visitas',
  ...soloJugador,
  checkinLimiter,
  checkinValidacion,
  validateRequest,
  registrarVisita
);

// ── Privacidad del jugador ───────────────────────────────
router.get('/perfil/privacidad', ...soloJugador, obtenerPrivacidad);

router.patch(
  '/perfil/privacidad',
  ...soloJugador,
  actualizarPrivacidadValidacion,
  validateRequest,
  actualizarPrivacidad
);

// ── Seguimiento (Follow) ─────────────────────────────────
router.get('/seguidores',           ...soloJugador, listarSeguidores);
router.post('/seguir/:usuarioId',   ...soloJugador, followLimiter, seguir);
router.delete('/seguir/:usuarioId', ...soloJugador, followLimiter, dejarDeSeguir);

export default router;