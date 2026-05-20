import { defaultRelaySet } from './default-relays';
import type { RelaySet } from './relay-store';

export function normalizeSeededRelaySets(
  relaySets: readonly RelaySet[],
): RelaySet[] {
  let changed = false;
  const next = relaySets.map((set) => {
    if (set.id !== defaultRelaySet.id || !set.seeded) return set;
    const relays = set.relays.filter(
      (relay) => relay.url !== 'wss://relay.nostr.band',
    );
    if (relays.length === set.relays.length) return set;
    changed = true;
    return { ...set, relays, updatedAt: Date.now() };
  });
  return changed ? next : [...relaySets];
}
