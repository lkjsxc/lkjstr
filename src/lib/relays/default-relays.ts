import type { RelaySet } from './relay-store';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
] as const;

export const defaultRelaySet: RelaySet = {
  id: 'public-default',
  name: 'Public Default',
  seeded: true,
  updatedAt: 0,
  relays: DEFAULT_RELAYS.map((url) => relay(url, labelFor(url))),
};

function labelFor(url: string): string {
  return new URL(url).hostname.replace(/^relay\./, '');
}

function relay(url: string, label: string) {
  return {
    url,
    label,
    enabled: true,
    read: true,
    write: true,
    state: 'idle' as const,
    health: { attempts: 0, successes: 0, failures: 0 },
    updatedAt: 0,
  };
}
