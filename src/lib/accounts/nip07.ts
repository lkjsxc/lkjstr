import type { NostrEvent, UnsignedNostrEvent } from '../protocol';
import { createAccount, type Account } from './account';

export type Nip07Provider = {
  readonly getPublicKey: () => Promise<string>;
  readonly signEvent: (event: UnsignedNostrEvent) => Promise<NostrEvent>;
};

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}

export function getNip07Provider(): Nip07Provider | undefined {
  return typeof window === 'undefined' ? undefined : window.nostr;
}

export async function connectNip07(
  provider = getNip07Provider(),
): Promise<Account | undefined> {
  if (!provider) return undefined;
  const pubkey = await provider.getPublicKey();
  return createAccount(pubkey, 'nip07', `NIP-07 ${pubkey.slice(0, 8)}`);
}
