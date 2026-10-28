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
 *   - Códigos de recuperación: alfabeto Base32 sin caracteres ambiguos
 *     (sin 0/O, 1/I/L) para que el usuario los pueda transcribir sin errores.
 */

export function generarTokenReset(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const ALFABETO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generarRecoveryCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  }
  return code; // Formato: XXXX-XXXX
}

export function generarRecoveryCodes(cantidad: number): string[] {
  return Array.from({ length: cantidad }, () => generarRecoveryCode());
}