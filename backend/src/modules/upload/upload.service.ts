import { promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../../config/logger';

export const CARPETAS_PERMITIDAS = ['avatares', 'eventos', 'negocios'] as const;
export type CarpetaUpload = typeof CARPETAS_PERMITIDAS[number];

const DIRECTORIO_UPLOADS = path.resolve(process.cwd(), 'uploads');
const EXTENSIONES_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class UploadConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadConfigurationError';
  }
}

function obtenerModoAlmacenamiento(): 'local' | 'cloudinary' {
  const solicitado = process.env.UPLOAD_STORAGE?.trim().toLowerCase();
  const credenciales = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ];
  const cloudinaryCompleto = credenciales.every(Boolean);
  const cloudinaryParcial = credenciales.some(Boolean) && !cloudinaryCompleto;

  if (solicitado === 'local') {
    if (process.env.NODE_ENV === 'production') {
      throw new UploadConfigurationError('El almacenamiento local de imágenes solo está disponible en desarrollo.');
    }
    return 'local';
  }
  if (solicitado === 'cloudinary') {
    if (!cloudinaryCompleto) {
      throw new UploadConfigurationError('Configura las tres credenciales de Cloudinary para usar ese almacenamiento.');
    }
    return 'cloudinary';
  }
  if (solicitado) {
    throw new UploadConfigurationError('UPLOAD_STORAGE debe ser "local" o "cloudinary".');
  }
  if (cloudinaryCompleto) return 'cloudinary';
  if (!cloudinaryParcial && process.env.NODE_ENV !== 'production') return 'local';

  throw new UploadConfigurationError('Configura Cloudinary para habilitar la subida de imágenes.');
}

function configurarCloudinary(): void {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function urlLocal(relativePath: string): string {
  const base = process.env.UPLOAD_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  let origin: string;
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    origin = parsed.origin;
  } catch {
    throw new UploadConfigurationError('UPLOAD_PUBLIC_URL debe ser una URL HTTP o HTTPS válida.');
  }
  const ruta = relativePath.split('/').map(encodeURIComponent).join('/');
  return `${origin}/uploads/${ruta}`;
}

export class UploadService {
  async subirImagen(
    fileBuffer: Buffer,
    carpeta: CarpetaUpload,
    mimeType: string
  ): Promise<{ url: string; publicId: string }> {
    if (!CARPETAS_PERMITIDAS.includes(carpeta)) {
      throw new Error(`Carpeta de subida no permitida: ${carpeta}`);
    }
    const extension = EXTENSIONES_POR_MIME[mimeType];
    if (!extension) throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');

    if (obtenerModoAlmacenamiento() === 'local') {
      const nombre = `${crypto.randomBytes(18).toString('hex')}.${extension}`;
      const rutaRelativa = `${carpeta}/${nombre}`;
      const directorio = path.join(DIRECTORIO_UPLOADS, carpeta);
      await fs.mkdir(directorio, { recursive: true });
      await fs.writeFile(path.join(directorio, nombre), fileBuffer, { flag: 'wx', mode: 0o644 });
      return {
        url: urlLocal(rutaRelativa),
        publicId: `local:${rutaRelativa}`,
      };
    }

    const transformacionesPorCarpeta = {
      eventos: [
        { width: 1200, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
      avatares: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
      negocios: [
        { width: 1600, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
    };

    configurarCloudinary();
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: `agenda-caucana/${carpeta}`,
          resource_type: 'image',
          transformation: transformacionesPorCarpeta[carpeta],
        },
        (error, result) => {
          if (error || !result) {
            logger.error({ mensaje: 'Cloudinary upload failed', error: error?.message });
            return reject(new Error('No se pudo subir la imagen'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      upload.end(fileBuffer);
    });
  }

  async eliminarImagen(publicId: string): Promise<{ result: string }> {
    if (publicId.startsWith('local:')) {
      const ruta = path.resolve(DIRECTORIO_UPLOADS, publicId.slice('local:'.length));
      const relativa = path.relative(DIRECTORIO_UPLOADS, ruta);
      if (!relativa || relativa.startsWith('..') || path.isAbsolute(relativa)) {
        throw new Error('Identificador de imagen local inválido.');
      }
      await fs.rm(ruta, { force: true });
      return { result: 'ok' };
    }

    if (obtenerModoAlmacenamiento() !== 'cloudinary') {
      throw new UploadConfigurationError('No se puede eliminar una imagen de Cloudinary sin sus credenciales.');
    }
    configurarCloudinary();
    return cloudinary.uploader.destroy(publicId);
  }
}