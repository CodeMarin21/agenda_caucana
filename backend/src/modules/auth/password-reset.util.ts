import crypto from 'crypto';

/**
 * Utilidades criptográficas del módulo de recuperación.
 *
 * Decisiones:
 *   - Tokens: 32 bytes random → 64 chars hex → ~256 bits de entropía.
 *   - Hash de tokens/códigos: SHA-256 (no bcrypt).
 *     Justificación: los tokens son aleatorios de alta entropía, no passwords
 *     humanos débiles. SHA-256 es suficiente y permite búsqueda por índice
 *     (@unique en tokenHash / codeHash). Es el estándar de GitHub, GitLab, etc.
 */

export function generarTokenReset(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
