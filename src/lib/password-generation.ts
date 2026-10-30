// 64 URL-safe characters divide the byte range evenly, so masking produces no modulo bias.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const PASSWORD_LENGTH = 24;

/** Generate a password on the user's device using cryptographically secure randomness. */
export function generateSecurePassword(): string {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new Error('Secure password generation is unavailable.');
  }

  const bytes = new Uint8Array(PASSWORD_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte & 63]).join('');
}
