import { Request } from 'express';
import { validationResult } from 'express-validator';
import { validarImagenUrl } from '../modules/eventos/eventos.dto';

describe('validarImagenUrl', () => {
  it('accepts a local development upload URL', async () => {
    const req = {
      body: { imagenUrl: 'http://localhost:3000/uploads/eventos/afiche.png' },
    } as unknown as Request;

    await validarImagenUrl.run(req);

    expect(validationResult(req).isEmpty()).toBe(true);
  });

  it('rejects non-HTTP image URLs', async () => {
    const req = {
      body: { imagenUrl: 'javascript:alert(1)' },
    } as unknown as Request;

    await validarImagenUrl.run(req);

    expect(validationResult(req).array().map((error) => error.msg))
      .toContain('La URL de la imagen no es válida');
  });
});
