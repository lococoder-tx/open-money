import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env.ts';

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/** AES-256-GCM. Output is `iv.tag.ciphertext`, each base64. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  if (!iv || !tag || !data) throw new Error('Malformed encrypted payload');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
