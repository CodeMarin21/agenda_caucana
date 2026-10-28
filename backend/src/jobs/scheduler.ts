import cron from 'node-cron';
import { logger } from '../config/logger';
import { limpiarRefreshTokensExpirados } from './limpiarRefreshTokens.job';
import { limpiarTokensExpirados }        from './limpiarTokensExpirados.job';
import { resetearRankingSemanal }        from './resetearRanking.job';
import { cerrarTemporadaSiCorresponde }  from './cerrarTemporada.job';

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

  // ── Reset ranking semanal — domingos 12:00 ──
  cron.schedule('0 12 * * 0', async () => {
    try {
      await resetearRankingSemanal();
    } catch (e) {
      logger.error({ job: 'resetearRankingSemanal', error: (e as Error).message });
    }
  }, { timezone: 'America/Bogota' });

  // ── Cierre de temporada — 1er domingo del mes, 12:05 ──
  cron.schedule('5 12 * * 0', async () => {
    try {
      await cerrarTemporadaSiCorresponde();
    } catch (e) {
      logger.error({ job: 'cerrarTemporada', error: (e as Error).message });
    }
  }, { timezone: 'America/Bogota' });

  logger.info(
    'Scheduler iniciado (cleanup/hora | reset semanal dom 12:00 | cierre temporada 1er dom 12:05 Bogotá)'
  );
}