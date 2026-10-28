import { Logro } from '@prisma/client';
import { LogroDesbloqueado } from './gamificacion.types';

export interface ContextoLogros {
  totalVisitas: number;
  visitasPorCategoria: Record<string, number>;
  rutasCompletadas: number;
}

/**
 * Motor de evaluación de logros.
 *
 * Reglas del schema (campo `categoria` de Logro):
 *   - "General"      → cuenta el total de visitas del jugador.
 *   - cualquier otra → cuenta las visitas en rutas con esa categoría.
 *
 * La evaluación es una función PURA (no toca BD), lo que la hace
 * testeable unitariamente sin mocks.
 */
export class LogrosEngine {
  evaluar(
    logros: Logro[],
    logrosYaDesbloqueados: Set<number>,
    ctx: ContextoLogros
  ): Logro[] {
    const desbloqueables: Logro[] = [];

    for (const logro of logros) {
      if (logrosYaDesbloqueados.has(logro.id)) continue;

      if (this.cumpleCondicion(logro, ctx)) {
        desbloqueables.push(logro);
      }
    }

    return desbloqueables;
  }

  private cumpleCondicion(logro: Logro, ctx: ContextoLogros): boolean {
    // Categoría "General" → total de visitas
    if (!logro.categoria || logro.categoria.toLowerCase() === 'general') {
      return ctx.totalVisitas >= logro.meta;
    }

    // Categoría específica → visitas en esa categoría de ruta
    const visitas = ctx.visitasPorCategoria[logro.categoria] ?? 0;
    return visitas >= logro.meta;
  }

  formatearDesbloqueados(logros: Logro[]): LogroDesbloqueado[] {
    return logros.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      descripcion: l.descripcion,
      icono: l.icono,
      categoria: l.categoria,
    }));
  }
}