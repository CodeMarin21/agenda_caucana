import { Router } from 'express';
import {
  registroOrganizador,
  listarOrganizadores,
  listarPendientes,
  verificarOrganizador,
  suspenderOrganizador,
  vetarOrganizador,
  reactivarOrganizador,
  obtenerPerfilOrganizador,
  actualizarPerfilOrganizador,
} from './organizadores.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import {
  registroOrganizadorValidacion,
  actualizarPerfilValidacion,
  motivoEstadoOrganizadorValidacion,
  motivoReactivacionValidacion,
} from './organizadores.dto';

const router = Router();

// POST /api/organizadores/registro — público
// ⚠️ CAMBIO DE COMPORTAMIENTO: antes esta ruta NO validaba nada.
//    Ahora ejecuta registroOrganizadorValidacion + validateRequest.
//    Es un fix de seguridad (evita registros con payloads basura).
router.post('/registro',
  registroOrganizadorValidacion, validateRequest,
  registroOrganizador
);

// ─────────────────────────────────────────────────────────
// B1: perfil del organizador logueado
// ─────────────────────────────────────────────────────────
router.get('/perfil',
  authMiddleware, requireRole('ORGANIZADOR'),
  obtenerPerfilOrganizador
);

router.patch('/perfil',
  authMiddleware, requireRole('ORGANIZADOR'),
  actualizarPerfilValidacion, validateRequest,
  actualizarPerfilOrganizador
);

// ─────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────
router.get('/',
  authMiddleware, requireRole('ADMIN'),
  listarOrganizadores
);

router.get('/pendientes',
  authMiddleware, requireRole('ADMIN'),
  listarPendientes
);

router.patch('/:id/verificar',
  authMiddleware, requireRole('ADMIN'),
  verificarOrganizador
);

router.patch('/:id/suspender',
  authMiddleware, requireRole('ADMIN'),
  motivoEstadoOrganizadorValidacion, validateRequest,
  suspenderOrganizador
);

// Veto (soft-delete + bloqueo de re-registro)
router.delete('/:id',
  authMiddleware, requireRole('ADMIN'),
  motivoEstadoOrganizadorValidacion, validateRequest,
  vetarOrganizador
);

// Reactivar (quita el veto)
router.patch('/:id/reactivar',
  authMiddleware, requireRole('ADMIN'),
  motivoReactivacionValidacion, validateRequest,
  reactivarOrganizador
);

export default router;