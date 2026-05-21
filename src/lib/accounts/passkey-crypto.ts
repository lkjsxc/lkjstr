import { base64urlToBytes, bytesToBase64url } from './base64url';

const keyInfo = new TextEncoder().encode('lkjstr passkey local account key');
const keySalt = new TextEncoder().encode('lkjstr passkey local account salt');

export type EncryptedSecret = {
  readonly ciphertext: string;
  readonly iv: string;
};

export async function encryptPasskeySecret(
  secretKey: string,
  prf: Uint8Array,
): Promise<EncryptedSecret> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(prf);
  const data = new TextEncoder().encode(secretKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data),
  );
  return {
    ciphertext: bytesToBase64url(new Uint8Array(ciphertext)),
    iv: bytesToBase64url(iv),
  };
}

export async function decryptPasskeySecret(
  encrypted: EncryptedSecret,
  prf: Uint8Array,
): Promise<string> {
  const key = await deriveAesKey(prf);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64urlToBytes(encrypted.iv)) },
    key,
    toArrayBuffer(base64urlToBytes(encrypted.ciphertext)),
  );
  return new TextDecoder().decode(plaintext);
}

async function deriveAesKey(prf: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(prf),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: keySalt, info: keyInfo },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
