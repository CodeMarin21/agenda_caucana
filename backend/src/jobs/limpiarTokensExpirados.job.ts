import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Elimina tokens de reset de contraseña expirados.
 * Los RecoveryCode NO se eliminan (no expiran, solo se consumen).
 *
 * Se ejecuta cada hora (ver scheduler.ts).
 */
export async function limpiarTokensExpirados(): Promise<void> {
  const resultado = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  if (resultado.count > 0) {
    logger.info(`🧹 ${resultado.count} tokens de reset expirados eliminados`);
  }
}