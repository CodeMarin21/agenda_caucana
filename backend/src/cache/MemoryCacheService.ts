import { ICacheService } from './ICacheService';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Caché en memoria con TTL + evicción LRU.
 * Apto para instancia única. Al escalar a múltiples instancias,
 * sustituir por RedisCacheService (misma interfaz).
 */
export class MemoryCacheService implements ICacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(maxSize = 1000, cleanupIntervalMs = 60_000) {
    this.maxSize = maxSize;
    this.cleanupTimer = setInterval(() => this.evictExpired(), cleanupIntervalMs);
    this.cleanupTimer.unref?.(); // no bloquear el cierre del proceso
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    // LRU: mover al final (más reciente)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  delByPrefix(prefix: string): void {
    if (!prefix) return;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
}