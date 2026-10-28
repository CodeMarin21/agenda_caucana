import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  registro,
  login,
  refreshToken,
  logout,
  perfil,
  solicitarReset,
  solicitarResetJugador,
  confirmarReset,
} from './auth.controller';
import {
  registroValidacion,
  loginValidacion,
  solicitarResetValidacion,
  solicitarResetJugadorValidacion,
  confirmarResetValidacion,
} from './auth.dto';
import { validateRequest } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// ── Rate limits ────────────────────────────────────────
// Login/registro: 10 intentos por 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
});

// Solicitudes de reset: 3 por hora por IP
// (el rate limit por email se aplica dentro del service)
const solicitarResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Demasiadas solicitudes de recuperación. Intenta en una hora.' },
});

// Confirmaciones de reset: 5 por hora por IP
const confirmarResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Intenta en una hora.' },
});

// ── Rutas existentes ───────────────────────────────────
router.post('/registro', authLimiter, registroValidacion, validateRequest, registro);
router.post('/login',    authLimiter, loginValidacion,    validateRequest, login);
router.post('/refresh',  refreshToken);
router.post('/logout',   logout);
router.get('/perfil',    authMiddleware, perfil);

// ── A.5.2: Recuperación de contraseña ─────────────────
router.post(
  '/solicitar-reset',
  solicitarResetLimiter,
  solicitarResetValidacion,
  validateRequest,
  solicitarReset
);

router.post(
  '/jugador/solicitar-reset',
  solicitarResetLimiter,
  solicitarResetJugadorValidacion,
  validateRequest,
  solicitarResetJugador
);

router.post(
  '/confirmar-reset',
  confirmarResetLimiter,
  confirmarResetValidacion,
  validateRequest,
  confirmarReset
);

export default router;