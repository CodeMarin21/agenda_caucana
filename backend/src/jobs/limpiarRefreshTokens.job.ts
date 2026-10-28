import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Elimina de la BD todos los refresh tokens ya expirados.
 * Sin este job, la tabla crece indefinidamente y cada refresh
 * escanea más filas de las necesarias.
 *
 * Se ejecuta cada hora (ver scheduler.ts).
 */
export async function limpiarRefreshTokensExpirados(): Promise<void> {
  const resultado = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  if (resultado.count > 0) {
    logger.info(`🧹 ${resultado.count} refresh tokens expirados eliminados`);
  }
}