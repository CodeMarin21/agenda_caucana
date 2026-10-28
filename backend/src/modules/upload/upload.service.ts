import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../../config/logger';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const CARPETAS_PERMITIDAS = ['avatares', 'eventos', 'negocios'] as const;
export type CarpetaUpload = typeof CARPETAS_PERMITIDAS[number];

export class UploadService {
  async subirImagen(
    fileBuffer: Buffer,
    carpeta: CarpetaUpload
  ): Promise<{ url: string; publicId: string }> {
    if (!CARPETAS_PERMITIDAS.includes(carpeta)) {
      throw new Error(`Carpeta de subida no permitida: ${carpeta}`);
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
}