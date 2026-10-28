import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

function manejarErrorPrisma(error: any): AppError {
  if (error.code === 'P2002') {
    const campo = error.meta?.target?.[0] ?? 'campo';
    return new AppError(`Ya existe un registro con ese ${campo}`, 409);
  }
  if (error.code === 'P2025') {
    return new AppError('Registro no encontrado', 404);
  }
  if (error.code === 'P2003') {
    return new AppError('Referencia invalida - el recurso relacionado no existe', 400);
  }
  return new AppError('Error de base de datos', 500);
}

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error.code?.startsWith('P')) {
    error = manejarErrorPrisma(error);
  }

  const statusCode = error.statusCode ?? 500;
  const mensaje    = error.isOperational ? error.message : 'Error interno del servidor';

  if (statusCode >= 500) {
    logger.error({
      mensaje: error.message,
      stack:   error.stack,
      url:     req.url,
      method:  req.method,
      ip:      req.ip,
    });
  } else {
    logger.warn({
      mensaje: error.message,
      url:     req.url,
      method:  req.method,
    });
  }

  res.status(statusCode).json({
    error: mensaje,
    ...(process.env.NODE_ENV === 'development' && {
      detalle: error.message,
      stack:   error.stack,
    }),
  });
}

export function setupUncaughtHandlers(): void {
  process.on('unhandledRejection', (reason: any) => {
    logger.error({
      tipo:    'unhandledRejection',
      mensaje: reason?.message ?? String(reason),
      stack:   reason?.stack,
    });
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error({
      tipo:    'uncaughtException',
      mensaje: error.message,
      stack:   error.stack,
    });
    setTimeout(() => process.exit(1), 1000);
  });
}