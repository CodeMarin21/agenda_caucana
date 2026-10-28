import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';

interface JwtPayload {
  usuarioId: number;
  rol: Rol;
  type: 'access' | 'refresh';
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Defensa critica: un refresh token NUNCA debe usarse como access token.
    // Ambos se firman con el mismo secret, asi que sin este check,
    // cualquiera que robe un refresh token puede entrar a rutas protegidas.
    if (payload.type !== 'access') {
      res.status(401).json({ error: 'Tipo de token invalido' });
      return;
    }

    req.usuarioId = payload.usuarioId;
    req.rol = payload.rol;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}