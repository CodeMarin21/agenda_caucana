import { Request, Response } from 'express';
import { CARPETAS_PERMITIDAS, CarpetaUpload, UploadService } from './upload.service';

const service = new UploadService();

const MIMES_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function esCarpetaPermitida(value: unknown): value is CarpetaUpload {
  return typeof value === 'string' &&
    CARPETAS_PERMITIDAS.some((carpeta) => carpeta === value);
}

export async function subirImagen(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se recibió ninguna imagen' });
      return;
    }

    if (!MIMES_VALIDOS.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Formato no soportado. Usa JPG, PNG o WebP.' });
      return;
    }

    if (req.file.size > MAX_BYTES) {
      res.status(400).json({ error: 'La imagen supera el límite de 5MB' });
      return;
    }

    const carpetaSolicitada = req.query.carpeta;
    if (!esCarpetaPermitida(carpetaSolicitada)) {
      const carpeta = typeof carpetaSolicitada === 'string'
        ? carpetaSolicitada
        : String(carpetaSolicitada);
      res.status(400).json({ error: `Carpeta de subida no permitida: ${carpeta}` });
      return;
    }
    const { url, publicId } = await service.subirImagen(req.file.buffer, carpetaSolicitada);

    res.status(201).json({ url, publicId });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al subir imagen';
    const status = mensaje.startsWith('Carpeta de subida no permitida:') ? 400 : 500;
    res.status(status).json({ error: mensaje });
  }
}