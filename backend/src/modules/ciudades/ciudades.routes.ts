import { Router } from 'express';
import {
  listarCiudades,
  listarLugaresCiudad,
  crearCiudad,
  crearLugar,
} from './ciudades.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole }    from '../../middlewares/role.middleware';

const router = Router();

// GET /api/ciudades — público
router.get('/', listarCiudades);

// GET /api/ciudades/:id/lugares — público
router.get('/:id/lugares', listarLugaresCiudad);

// POST /api/ciudades — solo ADMIN
router.post('/',
  authMiddleware, requireRole('ADMIN'),
  crearCiudad
);

// POST /api/ciudades/:id/lugares — solo ADMIN
router.post('/:id/lugares',
  authMiddleware, requireRole('ADMIN'),
  crearLugar
);

export default router;