/**
 * Devuelve el año-semana ISO 8601 actual.
 * Ej: "2026-W38" para la semana 38 de 2026.
 *
 * ISO 8601: la semana empieza lunes, termina domingo.
 * Es lo que necesitamos porque el reset corre domingos a las 12:00
 * → la semana nueva arranca el lunes.
 */
export function semanaIsoActual(fecha: Date = new Date()): string {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));

  // Jueves de esta semana (para determinar el año ISO correcto en semanas fronterizas)
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);

  const anioIso = d.getUTCFullYear();
  const inicioAnio = new Date(Date.UTC(anioIso, 0, 1));
  const numeroSemana = Math.ceil(
    ((d.getTime() - inicioAnio.getTime()) / 86_400_000 + 1) / 7
  );

  return `${anioIso}-W${String(numeroSemana).padStart(2, '0')}`;
}