import cron from 'node-cron';
import { logger } from '../config/logger';
import { limpiarRefreshTokensExpirados } from './limpiarRefreshTokens.job';
import { limpiarTokensExpirados }        from './limpiarTokensExpirados.job';
import { limpiarEventosFinalizados } from './limpiarEventosFinalizados.job';

export function iniciarScheduler(): void {
  // ── Limpieza (refresh tokens + tokens reset) — cada hora ──
  cron.schedule('0 * * * *', async () => {
    try {
      await limpiarRefreshTokensExpirados();
    } catch (e) {
      logger.error({ job: 'refresh-tokens', error: e instanceof Error ? e.message : String(e) });
    }
    try {
      await limpiarTokensExpirados();
    } catch (e) {
      logger.error({ job: 'password-reset-tokens', error: e instanceof Error ? e.message : String(e) });
    }
    try {
      await limpiarEventosFinalizados();
    } catch (e) {
      logger.error({ job: 'eventos-finalizados', error: e instanceof Error ? e.message : String(e) });
    }
  }, { timezone: 'America/Bogota' });

  logger.info('Scheduler iniciado (limpieza horaria de tokens y eventos finalizados)');
}