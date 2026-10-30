import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSecurePassword } from '../src/lib/password-generation';
import { isValidAdminPassword } from '../src/lib/password-policy';

test('password generation uses fresh unbiased secure bytes and never falls back to Math.random', () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalRandom = Math.random;
  let calls = 0;
  const bytes = [0, 1, 62, 63, 64, 65, 126, 127, 128, 129, 190, 191, 192, 193, 254, 255, 2, 3, 4, 5, 6, 7, 8, 9];
  try {
    Math.random = () => { throw new Error('Math.random must not be used'); };
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues(array: Uint8Array) { array.set(calls++ === 0 ? bytes : Array(24).fill(63)); return array; } },
    });
    const first = generateSecurePassword();
    const second = generateSecurePassword();
    assert.equal(first, 'AB-_AB-_AB-_AB-_CDEFGHIJ');
    assert.equal(second, '_'.repeat(24));
    assert.equal(calls, 2);
    assert.match(first, /^[A-Za-z0-9_-]{24}$/);
    assert.ok(isValidAdminPassword(first));
    assert.ok(Buffer.byteLength(first, 'utf8') <= 72);

    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    assert.throws(() => generateSecurePassword(), /secure password generation is unavailable/i);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues() { throw new Error('random source failed'); } } });
    assert.throws(() => generateSecurePassword(), /random source failed/);
  } finally {
    Math.random = originalRandom;
    if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
});
