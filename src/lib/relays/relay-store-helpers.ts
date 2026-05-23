import type { RelayRecord, RelaySet } from './relay-store';

export function createRelay(url: string): RelayRecord {
  const host = new URL(url).host;
  return {
    url,
    label: host,
    enabled: true,
    read: true,
    write: true,
    state: 'idle',
    updatedAt: Date.now(),
    health: { attempts: 0, successes: 0, failures: 0 },
  };
}

export function resetRelayLiveState(
  relaySets: readonly RelaySet[],
): RelaySet[] {
  let changed = false;
  const next = relaySets.map((set) => ({
    ...set,
    relays: set.relays.map((relay) => {
      if (relay.state === 'idle') return relay;
      changed = true;
      return { ...relay, state: 'idle' as const };
    }),
  }));
  return changed ? next : [...relaySets];
}
