import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { subirImagen } from './upload.controller';

const router = Router();

// Multer en memoria — no escribimos a disco, el buffer va directo a Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Rate limit específico — 20 uploads por 15 min
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas subidas. Espera unos minutos.' },
});

function manejarErrorMulter(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    const mensaje = error.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo supera el tamaño máximo permitido (5 MB)'
      : `Archivo inválido: ${error.code}`;
    res.status(400).json({ error: mensaje });
    return;
  }
  next(error);
}

router.post(
  '/imagen',
  authMiddleware,
  uploadLimiter,
  upload.single('file'),
  manejarErrorMulter,
  subirImagen
);

export default router;