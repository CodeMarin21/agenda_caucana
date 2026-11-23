import { promises as fs } from 'fs';
import path from 'path';
import { UploadService } from '../modules/upload/upload.service';

describe('UploadService local', () => {
  const service = new UploadService();
  const originalStorage = process.env.UPLOAD_STORAGE;
  const originalPublicUrl = process.env.UPLOAD_PUBLIC_URL;

  beforeAll(() => {
    process.env.UPLOAD_STORAGE = 'local';
    process.env.UPLOAD_PUBLIC_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    if (originalStorage === undefined) delete process.env.UPLOAD_STORAGE;
    else process.env.UPLOAD_STORAGE = originalStorage;
    if (originalPublicUrl === undefined) delete process.env.UPLOAD_PUBLIC_URL;
    else process.env.UPLOAD_PUBLIC_URL = originalPublicUrl;
  });

  it('stores the image locally and removes it by its generated public id', async () => {
    const uploaded = await service.subirImagen(
      Buffer.from('test-image'),
      'avatares',
      'image/png'
    );
    const filePath = path.resolve(
      process.cwd(),
      'uploads',
      uploaded.publicId.slice('local:'.length)
    );

    try {
      expect(uploaded.url).toMatch(/^http:\/\/localhost:3000\/uploads\/avatares\/[a-f0-9]+\.png$/);
      expect(await fs.readFile(filePath, 'utf8')).toBe('test-image');
      await service.eliminarImagen(uploaded.publicId);
      await expect(fs.access(filePath)).rejects.toThrow();
    } finally {
      await fs.rm(filePath, { force: true });
    }
  });
});
