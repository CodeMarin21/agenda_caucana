import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chat } from './ai.controller';
import { chatValidacion } from './ai.dto';
import { validateRequest } from '../../middlewares/validate.middleware';

const router = Router();

// 20 consultas / 10 min por IP. En memoria — válido para 1 instancia.
// Al escalar horizontalmente, migrar a rate-limit-redis con Upstash.
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas consultas al asistente. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/chat
router.post('/', chatLimiter, chatValidacion, validateRequest, chat);

export default router;