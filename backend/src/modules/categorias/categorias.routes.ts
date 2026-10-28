import { Router } from 'express';
import {
  listarCategorias,
  crearCategoria,
  eliminarCategoria,
} from './categorias.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole }    from '../../middlewares/role.middleware';

const router = Router();

// GET /api/categorias — público
router.get('/', listarCategorias);

// POST /api/categorias — solo ADMIN
router.post('/',
  authMiddleware, requireRole('ADMIN'),
  crearCategoria
);

// DELETE /api/categorias/:id — solo ADMIN
router.delete('/:id',
  authMiddleware, requireRole('ADMIN'),
  eliminarCategoria
);

export default router;