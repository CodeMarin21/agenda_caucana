import { logger } from './config/logger';
import app from './app';
import { prisma } from './config/database';
import { iniciarScheduler } from './jobs/scheduler';

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(PORT, () => {
  logger.info(`Agenda Caucana iniciado en http://localhost:${PORT}`);
  logger.info(`Ambiente: ${process.env.NODE_ENV}`);
  iniciarScheduler();
});

/**
 * Graceful shutdown.
 *
 * Orden de cierre:
 *   1. Dejar de aceptar conexiones nuevas (server.close).
 *   2. Esperar a que terminen las requests en vuelo.
 *   3. Desconectar Prisma (cierra pool limpiamente).
 *   4. Salir con código 0 (éxito) o 1 (error).
 *
 * Si en 10s no cerró todo → forzar salida con código 1.
 * Esto protege contra jobs colgados que dejan el pod en estado "terminating"
 * hasta que el orquestador lo mata por timeout.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Señal ${signal} recibida. Iniciando cierre ordenado...`);

  const forceExit = setTimeout(() => {
    logger.error('Timeout de cierre excedido. Forzando salida.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (err) => {
    if (err) {
      logger.error({ mensaje: 'Error cerrando HTTP server', error: err.message });
    } else {
      logger.info('HTTP server cerrado — sin conexiones entrantes.');
    }

    try {
      await prisma.$disconnect();
      logger.info('Prisma desconectado correctamente.');
    } catch (e) {
      logger.error({ mensaje: 'Error desconectando Prisma', error: (e as Error).message });
    }

    clearTimeout(forceExit);
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM')); // Railway / Docker
process.on('SIGINT',  () => void shutdown('SIGINT'));  // Ctrl+C local