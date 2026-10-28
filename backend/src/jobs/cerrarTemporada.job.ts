import { logger } from '../config/logger';
import { TemporadaService } from '../modules/gamificacion/temporada.service';

const temporadaSvc = new TemporadaService();

/**
 * Cierre de temporada — corre el 1er domingo de cada mes a las 12:05 PM
 * (hora Bogotá). 5 minutos después del reset semanal para evitar
 * condiciones de carrera (el reset semanal deja puntajeSemanal en 0,
 * pero puntajeTemporada NO se toca hasta este job).
 *
 * Guard interno: si el día del mes es > 7, salir. Esto filtra los
 * domingos que NO son el primero del mes (el cron `* * 0` corre todos
 * los domingos).
 */
export async function cerrarTemporadaSiCorresponde(): Promise<void> {
  const hoy = new Date();
  if (hoy.getDate() > 7) return;

  logger.info('Cerrando temporada mensual...');
  await temporadaSvc.cerrarTemporadaActual();
}