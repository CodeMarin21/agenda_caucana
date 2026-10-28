import { Router } from 'express';
import {
  listarEventos,
  obtenerEvento,
  listarTodos,
  listarPendientes,
  crearEvento,
  aprobarEvento,
  rechazarEvento,
  destacarEvento,
  eliminarEvento,
  misEventos,
} from './eventos.controller';
import { crearEventoValidacion, filtrosEventoValidacion } from './eventos.dto';
import { validateRequest }  from '../../middlewares/validate.middleware';
import { authMiddleware }   from '../../middlewares/auth.middleware';
import { requireRole }      from '../../middlewares/role.middleware';

const router = Router();

// ── Públicas ─────────────────────────────────────────────
router.get('/', filtrosEventoValidacion, validateRequest, listarEventos);

// ⚠️ IMPORTANTE: /mis-eventos debe ir ANTES de /:slug
// porque Express matchea rutas en orden y /:slug capturaría "mis-eventos".
router.get('/mis-eventos',
  authMiddleware, requireRole('ORGANIZADOR'),
  misEventos
);

router.get('/:slug', obtenerEvento);

// ── Admin ────────────────────────────────────────────────
router.get('/admin/todos',
  authMiddleware, requireRole('ADMIN'),
  listarTodos
);

router.get('/admin/pendientes',
  authMiddleware, requireRole('ADMIN'),
  listarPendientes
);

router.patch('/:id/aprobar',
  authMiddleware, requireRole('ADMIN'),
  aprobarEvento
);

router.patch('/:id/rechazar',
  authMiddleware, requireRole('ADMIN'),
  rechazarEvento
);

router.patch('/:id/destacar',
  authMiddleware, requireRole('ADMIN'),
  destacarEvento
);

// ── Admin + Organizador ──────────────────────────────────
// El controller verifica que si es ORGANIZADOR solo borre los suyos.
router.delete('/:id',
  authMiddleware, requireRole('ADMIN', 'ORGANIZADOR'),
  eliminarEvento
);

router.post('/',
  authMiddleware, requireRole('ORGANIZADOR'),
  crearEventoValidacion, validateRequest,
  crearEvento
);

export default router;