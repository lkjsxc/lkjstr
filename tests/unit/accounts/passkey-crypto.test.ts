import { describe, expect, it } from 'vitest';
import {
  base64urlToBytes,
  bytesToBase64url,
} from '../../../src/lib/accounts/base64url';
import {
  decryptPasskeySecret,
  encryptPasskeySecret,
} from '../../../src/lib/accounts/passkey-crypto';

describe('passkey crypto helpers', () => {
  it('round-trips base64url bytes without padding', () => {
    const bytes = new Uint8Array([0, 1, 2, 252, 253, 254, 255]);
    const encoded = bytesToBase64url(bytes);
    expect(encoded).not.toMatch(/[+/=]/u);
    expect([...base64urlToBytes(encoded)]).toEqual([...bytes]);
  });

  it('encrypts and decrypts a local secret with PRF material', async () => {
    const prf = new Uint8Array(32).fill(7);
    const encrypted = await encryptPasskeySecret('a'.repeat(64), prf);
    expect(encrypted.ciphertext).not.toContain('a'.repeat(16));
    await expect(decryptPasskeySecret(encrypted, prf)).resolves.toBe(
      'a'.repeat(64),
    );
  });
});
