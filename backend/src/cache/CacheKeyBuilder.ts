/**
 * CacheKeyBuilder — construcción consistente de claves de cache.
 *
 * Formato: `<namespace>:<entity>[:<attr>=<value>]...`
 *
 * Ejemplos:
 *   CacheKeyBuilder.create().ns('negocios').entity('list')
 *     .attr('page', 1).attr('limit', 20).attr('ciudad', 1)
 *     .build();
 *   // => "negocios:list:page=1:limit=20:ciudad=1"
 *
 *   CacheKeyBuilder.create().ns('negocios').entity('list').prefix();
 *   // => "negocios:list:"
 *   // (apto para delByPrefix)
 *
 * Reglas:
 *  - Separador entre segmentos: `:`.
 *  - Se sanitizan `:`, espacios y tabs dentro de cada parte,
 *    reemplazándolos por `_`. Previene colisiones accidentales.
 *  - El orden de los atributos importa (no se reordena). Es
 *    responsabilidad del consumidor mantener el orden consistente.
 */
export class CacheKeyBuilder {
  private readonly segments: string[] = [];

  static create(): CacheKeyBuilder {
    return new CacheKeyBuilder();
  }

  /** Namespace de dominio, ej. 'negocios', 'eventos', 'ia'. */
  ns(namespace: string): this {
    this.segments.push(CacheKeyBuilder.sanitize(namespace));
    return this;
  }

  /** Entidad o vista, ej. 'list', 'detail', 'count'. */
  entity(entity: string): this {
    this.segments.push(CacheKeyBuilder.sanitize(entity));
    return this;
  }

  /** Atributo con valor, ej. `attr('page', 1)` => `page=1`. */
  attr(name: string, value: string | number | boolean): this {
    const key = CacheKeyBuilder.sanitize(name);
    const val = CacheKeyBuilder.sanitize(String(value));
    this.segments.push(`${key}=${val}`);
    return this;
  }

  /** Segmento libre (sanitizado internamente). */
  raw(segment: string): this {
    this.segments.push(CacheKeyBuilder.sanitize(segment));
    return this;
  }

  /** Clave completa. */
  build(): string {
    return this.segments.join(':');
  }

  /**
   * Prefijo para usar con `delByPrefix`. Incluye el separador final
   * para evitar matches parciales no deseados
   * (ej. `negocios:list:1` no debe ser alcanzado por `negocios:list:`).
   */
  prefix(): string {
    return this.segments.length === 0 ? '' : this.segments.join(':') + ':';
  }

  private static sanitize(part: string): string {
    return part.replace(/[\s:]+/g, '_');
  }
}
