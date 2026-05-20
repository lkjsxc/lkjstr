import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
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

export function parseNsec(input: string): Uint8Array | undefined {
  try {
    const decoded = nip19.decode(input.trim());
    if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array))
      return undefined;
    getPublicKey(decoded.data);
    return decoded.data;
  } catch {
    return undefined;
  }
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
  return finalizeEvent(
    { ...event, tags: event.tags.map((tag) => [...tag]) },
    hexToBytes(secretKey),
  ) as NostrEvent;
}
