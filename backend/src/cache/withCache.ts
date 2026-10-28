import { getCacheService } from './singleton';
import { ICacheService } from './ICacheService';

export interface WithCacheOptions<Args extends unknown[], Result> {
  /**
   * Clave estática o función que deriva la clave a partir de los
   * argumentos. Se recomienda usar `CacheKeyBuilder`.
   */
  key: string | ((...args: Args) => string);

  /** TTL en MILISEGUNDOS. Debe ser > 0. */
  ttlMs: number;

  /**
   * Predicado para decidir si un resultado debe cachearse.
   * Default: cachea todo excepto `null` y `undefined`.
   */
  shouldCache?: (result: Result) => boolean;

  /**
   * Proveedor alternativo (tests). Default: el singleton
   * `getCacheService()`.
   */
  provider?: ICacheService;
}

function defaultShouldCache(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Envuelve una función async con cache transparente.
 *
 * Comportamiento:
 *  1. Deriva la clave (estática o por args).
 *  2. Intenta leer del cache. Si hay hit, retorna sin ejecutar `fn`.
 *  3. Si hay miss, ejecuta `fn`.
 *  4. Si `shouldCache(result)`, almacena con el TTL dado.
 *  5. Retorna el resultado.
 *
 * El contrato de `withCache` es async por fuera aunque el cache
 * subyacente sea sync. Razón: cuando se sustituya por un
 * `RedisCacheService` async, la firma pública no cambia.
 *
 * Consideraciones:
 *  - `null` y `undefined` NUNCA se cachean por default. Evita
 *    "negative caching" accidental.
 *  - No hay deduplicación de llamadas concurrentes (cache stampede).
 *    Mejora futura si el tráfico lo requiere.
 */
export function withCache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: WithCacheOptions<Args, Result>,
): (...args: Args) => Promise<Result> {
  const shouldCache = options.shouldCache ?? defaultShouldCache;

  return async (...args: Args): Promise<Result> => {
    const provider = options.provider ?? getCacheService();
    const key =
      typeof options.key === 'function' ? options.key(...args) : options.key;

    const cached = provider.get<Result>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fn(...args);

    if (shouldCache(fresh)) {
      provider.set(key, fresh, options.ttlMs);
    }

    return fresh;
  };
}
