import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import {
  CARPETAS_PERMITIDAS,
  CarpetaUpload,
  UploadConfigurationError,
  UploadService,
} from './upload.service';

const service = new UploadService();

const MIMES_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function esCarpetaPermitida(value: unknown): value is CarpetaUpload {
  return typeof value === 'string' &&
    CARPETAS_PERMITIDAS.some((carpeta) => carpeta === value);
}

function coincideFirmaImagen(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
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

    if (!coincideFirmaImagen(req.file.buffer, req.file.mimetype)) {
      res.status(400).json({ error: 'El contenido del archivo no coincide con una imagen JPG, PNG o WebP válida.' });
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
    const { url, publicId } = await service.subirImagen(
      req.file.buffer,
      carpetaSolicitada,
      req.file.mimetype
    );

    res.status(201).json({ url, publicId });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al subir imagen';
    const status = error instanceof UploadConfigurationError
      ? 503
      : mensaje.startsWith('Carpeta de subida no permitida:') || mensaje.startsWith('Formato no soportado.')
        ? 400
        : 500;
    logger.error({
      mensaje: 'Falló la subida de imagen',
      carpeta: req.query.carpeta,
      error: mensaje,
    });
    res.status(status).json({
      error: status === 500 ? 'No se pudo subir la imagen.' : mensaje,
    });
  }
}