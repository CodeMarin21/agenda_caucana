/**
 * Cálculo del progreso de rutas y progreso global del jugador.
 * Aislado para poder testearlo sin BD (funciones puras).
 */
export class ProgresoCalculator {
  /**
   * Porcentaje de progreso de una ruta (0-100).
   * puntosTotales = cuántos PDI tiene la ruta.
   * puntosVisitados = cuántos ya visitó el jugador.
   */
  calcularPorcentajeRuta(puntosVisitados: number, puntosTotales: number): number {
    if (puntosTotales <= 0) return 0;
    const pct = (puntosVisitados / puntosTotales) * 100;
    return Math.round(pct * 100) / 100; // 2 decimales
  }

  /**
   * Progreso global = promedio ponderado de los porcentajes de todas las rutas activas.
   * Si una ruta no tiene puntos, no cuenta para el promedio.
   */
  calcularProgresoGlobal(porcentajes: number[]): number {
    const validos = porcentajes.filter((p) => p > 0 || p === 0);
    if (validos.length === 0) return 0;
    const suma = validos.reduce((acc, p) => acc + p, 0);
    return Math.round((suma / validos.length) * 100) / 100;
  }

  /**
   * Nivel del jugador a partir del puntaje total.
   * Fórmula: nivel = floor(sqrt(puntaje / 50)) + 1
   * → 0 puntos → Nivel 1
   * → 50 puntos → Nivel 2
   * → 200 puntos → Nivel 3
   * → 450 puntos → Nivel 4
   * → 800 puntos → Nivel 5
   */
  calcularNivel(puntajeTotal: number): number {
    if (puntajeTotal < 0) return 1;
    return Math.floor(Math.sqrt(puntajeTotal / 50)) + 1;
  }

  /**
   * Puntos que otorga una visita nueva: 10 base + bonus por primera visita.
   */
  calcularPuntosVisita(esPrimeraVisita: boolean): number {
    return esPrimeraVisita ? 10 : 0;
  }
}