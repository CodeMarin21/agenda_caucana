import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Formato legible para desarrollo
const formatoDesarrollo = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${stack ?? message}${extra}`;
  })
);

// Formato JSON para producción (fácil de procesar por herramientas de monitoreo)
const formatoProduccion = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

const esDesarrollo = process.env.NODE_ENV === 'development';

export const logger = winston.createLogger({
  level: esDesarrollo ? 'debug' : 'info',
  format: esDesarrollo ? formatoDesarrollo : formatoProduccion,
  transports: [
    // Siempre mostrar en consola
    new winston.transports.Console(),

    // Archivo para errores
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB máx por archivo
      maxFiles: 5,
    }),

    // Archivo para todo
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});