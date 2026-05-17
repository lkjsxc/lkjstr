import type { RelaySet } from './relay-store';

export const defaultRelaySet: RelaySet = {
  id: 'public-default',
  name: 'Public Default',
  seeded: true,
  updatedAt: 0,
  relays: [
    relay('wss://relay.damus.io', 'Damus'),
    relay('wss://nos.lol', 'nos.lol'),
    relay('wss://relay.primal.net', 'Primal'),
    relay('wss://relay.nostr.band', 'Nostr.Band'),
    relay('wss://offchain.pub', 'Offchain'),
  ],
};

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
