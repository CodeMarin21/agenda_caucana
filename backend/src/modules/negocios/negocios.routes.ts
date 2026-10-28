import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  aprobarNegocio,
  calificarNegocio,
  crearNegocio,
  destacarNegocio,
  eliminarNegocio,
  listarNegocios,
  listarPendientes,
  listarTodos,
  misNegocios,
  obtenerNegocio,
  rechazarNegocio,
} from './negocios.controller';
import {
  calificarValidacion,
  crearNegocioValidacion,
  filtrosNegociosValidacion,
} from './negocios.dto';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';

const router = Router();

const calificacionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Máximo 5 calificaciones por hora desde esta IP.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', filtrosNegociosValidacion, validateRequest, listarNegocios);

router.get(
  '/mis-negocios',
  authMiddleware,
  requireRole('ORGANIZADOR'),
  misNegocios
);

router.get(
  '/admin/todos',
  authMiddleware,
  requireRole('ADMIN'),
  listarTodos
);

router.get(
  '/admin/pendientes',
  authMiddleware,
  requireRole('ADMIN'),
  listarPendientes
);

router.patch(
  '/:id/aprobar',
  authMiddleware,
  requireRole('ADMIN'),
  aprobarNegocio
);

router.patch(
  '/:id/rechazar',
  authMiddleware,
  requireRole('ADMIN'),
  rechazarNegocio
);

router.patch(
  '/:id/destacar',
  authMiddleware,
  requireRole('ADMIN'),
  destacarNegocio
);

router.post(
  '/:id/calificar',
  calificacionLimiter,
  calificarValidacion,
  validateRequest,
  calificarNegocio
);

router.get('/:slug', obtenerNegocio);

router.post(
  '/',
  authMiddleware,
  requireRole('ORGANIZADOR'),
  crearNegocioValidacion,
  validateRequest,
  crearNegocio
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('ORGANIZADOR', 'ADMIN'),
  eliminarNegocio
);

export default router;
