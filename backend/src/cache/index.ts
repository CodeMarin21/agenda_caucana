/**
 * Cache module — punto de entrada único.
 *
 * Uso típico:
 *
 *   import {
 *     withCache,
 *     CacheKeyBuilder,
 *     getCacheService,
 *   } from '../cache';
 *
 *   const listar = withCache(
 *     async (page: number) => repo.list(page),
 *     {
 *       key: (page) =>
 *         CacheKeyBuilder.create().ns('negocios').entity('list')
 *           .attr('page', page).build(),
 *       ttlMs: 300_000,
 *     },
 *   );
 *
 *   // Invalidación explícita al cambiar datos:
 *   getCacheService().delByPrefix(
 *     CacheKeyBuilder.create().ns('negocios').entity('list').prefix(),
 *   );
 *
 * Para migrar a Redis en el futuro:
 *
 *   import { setCacheService } from './cache';
 *   import { RedisCacheService } from './cache/RedisCacheService';
 *   setCacheService(new RedisCacheService(redisClient));
 *
 * Ningún consumidor necesita cambiar.
 */
export { getCacheService, setCacheService } from './singleton';
export type { ICacheService } from './ICacheService';
export { MemoryCacheService } from './MemoryCacheService';
export { CacheKeyBuilder } from './CacheKeyBuilder';
export { withCache } from './withCache';
export type { WithCacheOptions } from './withCache';

/**
 * Alias documental. Cuando se agregue RedisCacheService, este será
 * el nombre canónico. Hoy es equivalente a `ICacheService`.
 */
export type ICacheProvider = import('./ICacheService').ICacheService;
