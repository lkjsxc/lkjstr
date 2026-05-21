import { base64urlToBytes } from './base64url';
import type { PasskeyAccountSecret } from './passkey-secret-store';

export const portablePasskeyApp = 'lkjstr';
export const portablePasskeyFormat = 'lkjstr-passkey-secret';
export const missingPortablePasskeyDataMessage =
  'This passkey does not contain portable lkjstr data. Use the browser profile that created it, unlock a listed passkey account, or create a new passkey from nsec.';

export type PortablePasskeyBlob = PasskeyAccountSecret & {
  readonly app: typeof portablePasskeyApp;
  readonly format: typeof portablePasskeyFormat;
};

export function encodePortablePasskeyBlob(
  secret: PasskeyAccountSecret,
): Uint8Array {
  const blob: PortablePasskeyBlob = {
    app: portablePasskeyApp,
    format: portablePasskeyFormat,
    ...secret,
  };
  return new TextEncoder().encode(JSON.stringify(blob));
}

export function decodePortablePasskeyBlob(
  source: BufferSource | undefined,
): PasskeyAccountSecret {
  if (!source) throw new Error(missingPortablePasskeyDataMessage);
  const parsed = JSON.parse(
    new TextDecoder().decode(bytes(source)),
  ) as Partial<PortablePasskeyBlob>;
  if (parsed.app !== portablePasskeyApp)
    throw new Error('Passkey data belongs to another app.');
  if (parsed.format !== portablePasskeyFormat)
    throw new Error('Passkey data has an unsupported format.');
  const secret = {
    accountId: stringField(parsed.accountId, 'accountId'),
    pubkey: hexField(parsed.pubkey, 'pubkey'),
    credentialId: stringField(parsed.credentialId, 'credentialId'),
    saltLabel: stringField(parsed.saltLabel, 'saltLabel'),
    ciphertext: stringField(parsed.ciphertext, 'ciphertext'),
    iv: stringField(parsed.iv, 'iv'),
    createdAt: numberField(parsed.createdAt, 'createdAt'),
    updatedAt: numberField(parsed.updatedAt, 'updatedAt'),
  };
  base64urlToBytes(secret.credentialId);
  base64urlToBytes(secret.ciphertext);
  base64urlToBytes(secret.iv);
  return secret;
}

function bytes(source: BufferSource): Uint8Array {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`Passkey data is missing ${field}.`);
  return value;
}

function hexField(value: unknown, field: string): string {
  const text = stringField(value, field);
  if (!/^[0-9a-f]{64}$/u.test(text))
    throw new Error(`Passkey data has an invalid ${field}.`);
  return text;
}

function numberField(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`Passkey data is missing ${field}.`);
  return value;
}
