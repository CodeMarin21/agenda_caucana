import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Reset semanal del leaderboard de Popayán Go (RF4.8).
 *
 * Reglas del requisito:
 *   - Se ejecuta los domingos a las 12:00 PM (hora Colombia).
 *   - Arranca ciclo nuevo el lunes.
 *
 * Nota: `puntajeTotal` NO se toca — acumula histórico.
 * Solo `puntajeSemanal` vuelve a 0.
 */
export async function resetearRankingSemanal(): Promise<void> {
  logger.info('⏰ Iniciando reset semanal de ranking...');

  const resultado = await prisma.jugador.updateMany({
    data: { puntajeSemanal: 0 },
  });

  logger.info(`✅ Ranking reseteado: ${resultado.count} jugadores en ciclo nuevo`);
}