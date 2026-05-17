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
  const labels: Record<string, string> = {
    'wss://relay.damus.io': 'Damus',
    'wss://nos.lol': 'nos.lol',
    'wss://relay.primal.net': 'Primal',
    'wss://relay.nostr.band': 'Nostr.Band',
    'wss://offchain.pub': 'Offchain',
  };
  return labels[url] ?? new URL(url).hostname.replace(/^relay\./, '');
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
