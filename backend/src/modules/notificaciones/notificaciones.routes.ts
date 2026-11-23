import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from './notificaciones.controller';

const router = Router();

router.use(authMiddleware, requireRole('ORGANIZADOR'));
router.get('/', listarNotificaciones);
router.patch('/leidas', marcarTodasLeidas);
router.patch('/:id/leida', marcarNotificacionLeida);

export default router;
