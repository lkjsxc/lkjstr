import {
  bytesToHex,
  decodeEntity,
  encodeNsec,
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  parseSecretKeyHex,
} from '../protocol';
import type { NostrEvent, UnsignedNostrEvent } from '../protocol';
import { createAccount, type Account } from './account';
import { saveLocalSecret } from './local-secret-store';

export function createLocalAccountRecord(secretKey = generateSecretKey()): {
  readonly account: Account;
  readonly secretKey: string;
} {
  const pubkey = getPublicKey(secretKey);
  return {
    account: createAccount(pubkey, 'local', `Local ${pubkey.slice(0, 8)}`),
    secretKey: bytesToHex(secretKey),
  };
}

export function generateNsec(): string {
  return encodeNsec(generateSecretKey());
}

export function parseNsec(input: string): Uint8Array | undefined {
  const decoded = decodeEntity(input.trim());
  if (decoded?.type !== 'nsec') return undefined;
  return parseSecretKeyHex(bytesToHex(decoded.data));
}

export async function persistLocalAccount(
  account: Account,
  secretKey: string,
): Promise<Account> {
  const now = Date.now();
  await saveLocalSecret({
    accountId: account.id,
    pubkey: account.pubkey,
    secretKey,
    createdAt: now,
    updatedAt: now,
  });
  return account;
}

export function signLocalEvent(
  event: UnsignedNostrEvent,
  secretKey: string,
): NostrEvent {
  return finalizeEvent(event, secretKey);
}
