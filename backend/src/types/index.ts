import { Rol } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      idioma: string;
      usuarioId?: number;
      rol?: Rol;      // ← antes: string
    }
  }
}

export {};