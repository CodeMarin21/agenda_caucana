import cron from 'node-cron';
import { logger } from '../config/logger';
import { limpiarRefreshTokensExpirados } from './limpiarRefreshTokens.job';
import { limpiarTokensExpirados }        from './limpiarTokensExpirados.job';

export function iniciarScheduler(): void {
  // ── Limpieza (refresh tokens + tokens reset) — cada hora ──
  cron.schedule('0 * * * *', async () => {
    try {
      await limpiarRefreshTokensExpirados();
      await limpiarTokensExpirados();
    } catch (e) {
      logger.error({ job: 'limpieza', error: (e as Error).message });
    }
  }, { timezone: 'America/Bogota' });

  logger.info('Scheduler iniciado (limpieza de tokens cada hora)');
}