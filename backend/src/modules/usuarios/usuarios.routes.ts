import { Router } from 'express';
import { suscribirse, cancelarSuscripcion } from './usuarios.controller';

const router = Router();

// POST /api/suscripciones
router.post('/', suscribirse);

// DELETE /api/suscripciones
router.delete('/', cancelarSuscripcion);

export default router;