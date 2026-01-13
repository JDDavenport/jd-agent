/**
 * Encryption utilities for sensitive data (Plaid access tokens)
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns the encrypted data and initialization vector
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine encrypted data with auth tag
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt data that was encrypted with the encrypt function
 */
export function decrypt(encryptedData: string, iv: string): string {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract auth tag from end
  const authTag = combined.slice(-AUTH_TAG_LENGTH);
  const encrypted = combined.slice(0, -AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
  const key = process.env.ENCRYPTION_KEY;
  return !!key && key.length === 64;
}
