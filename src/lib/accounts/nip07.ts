import type { NostrEvent, UnsignedNostrEvent } from '../protocol';
import { shortKey, type Account } from './account';

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
  return { mode: 'nip07', pubkey, label: `NIP-07 ${shortKey(pubkey)}` };
}
