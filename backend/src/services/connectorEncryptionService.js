/**
 * connectorEncryptionService.js
 * Cifrado/descifrado AES-256-GCM para tokens de conectores externos.
 * La clave se lee de CONNECTOR_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Si no está definida, se usa una clave de desarrollo (solo para local).
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;   // 96 bits — recomendado para GCM
const TAG_BYTES = 16;  // 128 bits

/** Devuelve la clave como Buffer de 32 bytes */
function getKey() {
    const raw = process.env.CONNECTOR_ENCRYPTION_KEY || '';
    if (raw.length === 64) {
        return Buffer.from(raw, 'hex');
    }
    // Clave de desarrollo (NUNCA en producción sin CONNECTOR_ENCRYPTION_KEY)
    if (process.env.NODE_ENV !== 'production') {
        return Buffer.from('00000000000000000000000000000000' +
                           '00000000000000000000000000000000', 'hex');
    }
    throw new Error('Variable de entorno CONNECTOR_ENCRYPTION_KEY no configurada');
}

/**
 * Cifra un texto plano y devuelve una cadena base64 con el formato:
 *   <iv:24 chars hex>:<tag:32 chars hex>:<ciphertext base64>
 */
export function encryptToken(plaintext) {
    if (!plaintext) return plaintext;
    const key = getKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`;
}

/**
 * Descifra una cadena cifrada con encryptToken y devuelve el texto plano.
 */
export function decryptToken(ciphertext) {
    if (!ciphertext) return ciphertext;
    // Si no tiene el formato esperado, asumimos que no está cifrado (migración)
    if (!ciphertext.includes(':')) return ciphertext;
    const key = getKey();
    const [ivHex, tagHex, encBase64] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encBuf = Buffer.from(encBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encBuf) + decipher.final('utf8');
}
