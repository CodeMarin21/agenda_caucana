import { Request } from 'express';
import { validationResult } from 'express-validator';
import { validarImagenPrincipalUrl } from '../modules/negocios/negocios.dto';

describe('validarImagenPrincipalUrl', () => {
  it('accepts a local development upload URL', async () => {
    const req = {
      body: {
        imagenPrincipalUrl: 'http://localhost:3000/uploads/negocios/imagen.png',
      },
    } as unknown as Request;

    await validarImagenPrincipalUrl.run(req);

    expect(validationResult(req).isEmpty()).toBe(true);
  });

  it('rejects non-HTTP image URLs', async () => {
    const req = {
      body: { imagenPrincipalUrl: 'javascript:alert(1)' },
    } as unknown as Request;

    await validarImagenPrincipalUrl.run(req);

    expect(validationResult(req).array().map((error) => error.msg))
      .toContain('La URL de la imagen principal no es válida');
  });
});
