/**
 * Utilidades de cifrado para datos personales sensibles.
 *
 * - cifrar/descifrar: AES-256-GCM (cifrado autenticado, detecta manipulación).
 * - hashDocumento: HMAC-SHA256 con la misma clave (determinístico, resistente
 *   a ataques de diccionario, permite validar unicidad sin descifrar).
 * - enmascararDocumento: *******1234 (últimos 4 dígitos visibles).
 *
 * Requiere IDENTIDAD_ENCRYPTION_KEY en .env (64 caracteres hex = 32 bytes).
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM

function getKey(): Buffer {
  const key = process.env.IDENTIDAD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'IDENTIDAD_ENCRYPTION_KEY no configurada. Genera una con: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('IDENTIDAD_ENCRYPTION_KEY debe tener 64 caracteres hex (32 bytes).');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Cifra un texto con AES-256-GCM.
 * Formato de salida: "<iv-hex>:<authTag-hex>:<cifrado-hex>"
 */
export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un texto cifrado con `cifrar`. Lanza si el formato o el authTag fallan.
 */
export function descifrar(cifrado: string): string {
  const partes = cifrado.split(':');
  if (partes.length !== 3) throw new Error('Formato de cifrado inválido.');
  const [ivHex, authTagHex, dataHex] = partes;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * HMAC-SHA256 del documento normalizado (solo dígitos).
 * Determinístico: mismo input → mismo output. Sirve para:
 *  - Validar unicidad de documento entre organizadores.
 *  - Bloquear re-registro de un documento vetado.
 */
export function hashDocumento(documento: string): string {
  const normalizado = documento.replace(/\D/g, '');
  return crypto.createHmac('sha256', getKey()).update(normalizado).digest('hex');
}

/**
 * Devuelve el documento enmascarado: solo los últimos 4 dígitos.
 * Ej: "1061789456" → "******9456"
 */
export function enmascararDocumento(documento: string): string {
  const limpio = String(documento || '').replace(/\D/g, '');
  if (limpio.length <= 4) return '*'.repeat(limpio.length);
  return '*'.repeat(limpio.length - 4) + limpio.slice(-4);
}