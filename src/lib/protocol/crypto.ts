import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes, tryHexToBytes } from './bytes';

export function generateSecretKey(): Uint8Array {
  return schnorr.utils.randomSecretKey();
}

export function parseSecretKeyHex(hex: string): Uint8Array | undefined {
  const bytes = tryHexToBytes(hex);
  if (!bytes || bytes.length !== 32) return undefined;
  try {
    schnorr.getPublicKey(bytes);
    return bytes;
  } catch {
    return undefined;
  }
}

export function getPublicKey(secretKey: Uint8Array | string): string {
  const secret =
    typeof secretKey === 'string' ? secretKeyBytes(secretKey) : secretKey;
  return bytesToHex(schnorr.getPublicKey(secret));
}

export function signSchnorrHex(
  messageHashHex: string,
  secretKey: Uint8Array | string,
): string {
  const message = fixedBytes(messageHashHex, 32);
  const secret =
    typeof secretKey === 'string' ? secretKeyBytes(secretKey) : secretKey;
  return bytesToHex(schnorr.sign(message, secret));
}

export function verifySchnorrHex(
  signatureHex: string,
  messageHashHex: string,
  pubkeyHex: string,
): boolean {
  try {
    return schnorr.verify(
      fixedBytes(signatureHex, 64),
      fixedBytes(messageHashHex, 32),
      fixedBytes(pubkeyHex, 32),
    );
  } catch {
    return false;
  }
}

function secretKeyBytes(hex: string): Uint8Array {
  const bytes = parseSecretKeyHex(hex);
  if (!bytes) throw new Error('invalid secret key');
  return bytes;
}

function fixedBytes(hex: string, length: number): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length !== length) throw new Error('invalid byte length');
  return bytes;
}
