import { Request, Response, NextFunction } from 'express';
import { Rol } from '@prisma/client';

// Patrón Decorator — genera middlewares que verifican el rol del usuario.
// Uso: requireRole(Rol.ADMIN) o requireRole(Rol.ADMIN, Rol.ORGANIZADOR)
export function requireRole(...roles: Rol[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.rol) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.rol)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
}