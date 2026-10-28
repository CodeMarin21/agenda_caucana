import { ICacheService } from './ICacheService';
import { MemoryCacheService } from './MemoryCacheService';

/**
 * Singleton del cache. Vive en su propio archivo para romper el
 * ciclo de imports entre `index.ts` (que re-exporta `withCache`)
 * y `withCache.ts` (que necesita `getCacheService`).
 *
 * El día que se migre a Redis, sólo cambia la línea de instanciación:
 *   if (process.env.REDIS_URL) instance = new RedisCacheService(...);
 */
let instance: ICacheService | null = null;

export function getCacheService(): ICacheService {
  if (!instance) {
    instance = new MemoryCacheService(1000, 60_000);
  }
  return instance;
}

/**
 * Reemplaza el singleton. Uso principal: tests y migración futura
 * a Redis. NO llamar en runtime por request.
 */
export function setCacheService(service: ICacheService): void {
  instance = service;
}
