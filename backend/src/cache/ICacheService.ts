export interface ICacheService {
  /** Recupera el valor o `null` si no existe / expiró. */
  get<T>(key: string): T | null;

  /**
   * Guarda `value` bajo `key` con TTL en MILISEGUNDOS.
   * Si `ttlMs <= 0`, la entrada se elimina.
   */
  set<T>(key: string, value: T, ttlMs: number): void;

  /** Elimina una clave. No-op si no existe. */
  delete(key: string): void;

  /**
   * Elimina todas las claves que comiencen con `prefix`.
   * Uso principal: invalidación por namespace tras cambios de datos.
   * Ej: `delByPrefix('negocios:list:')`.
   */
  delByPrefix(prefix: string): void;

  /** `true` si `key` existe y no ha expirado. */
  has(key: string): boolean;

  /** Limpia todo el cache. */
  clear(): void;

  /** Número de entradas actuales (incluye expiradas aún no barridas). */
  readonly size: number;
}