import { createHash } from 'crypto';
import { decrypt, encrypt, isEncryptionConfigured } from '../lib/encryption';

const ENCRYPTION_ENABLED =
  process.env.AD_EXCHANGE_ENCRYPTION_ENABLED !== 'false' && isEncryptionConfigured();

const STORE_PLAINTEXT = process.env.AD_EXCHANGE_STORE_PLAINTEXT === 'true';

export function isAdExchangeEncryptionEnabled() {
  return ENCRYPTION_ENABLED;
}

export function shouldStorePlaintext() {
  return STORE_PLAINTEXT || !ENCRYPTION_ENABLED;
}

export function encryptAddress(address?: string | null) {
  if (!address || !ENCRYPTION_ENABLED) return null;
  const { encrypted, iv } = encrypt(address);
  return `${iv}:${encrypted}`;
}

export function decryptAddress(payload?: string | null) {
  if (!payload || !ENCRYPTION_ENABLED) return null;
  const [iv, encrypted] = payload.split(':');
  if (!iv || !encrypted) return null;
  return decrypt(encrypted, iv);
}

export function maskAddress(address?: string | null) {
  if (!address) return address ?? null;
  if (address.length <= 10) return `${address.slice(0, 3)}…${address.slice(-2)}`;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function resolveAddress(plain?: string | null, encrypted?: string | null) {
  if (ENCRYPTION_ENABLED && encrypted) {
    return decryptAddress(encrypted) ?? plain ?? null;
  }
  return plain ?? null;
}

export function hashAddress(address?: string | null) {
  if (!address) return null;
  return createHash('sha256').update(address.toLowerCase()).digest('hex');
}
