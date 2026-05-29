import { defaultDiscoveryRelaySet, defaultRelaySet } from './default-relays';
import type { RelaySet } from './relay-store';

export function normalizeSeededRelaySets(
  relaySets: readonly RelaySet[],
): RelaySet[] {
  let changed = false;
  const next = relaySets.map((set) => {
    const purpose = set.purpose ?? 'user';
    const normalizedSet = set.purpose ? set : { ...set, purpose };
    const defaults =
      purpose === 'discovery' ? defaultDiscoveryRelaySet : defaultRelaySet;
    if (normalizedSet.id !== defaults.id || !normalizedSet.seeded) {
      if (normalizedSet !== set) changed = true;
      return normalizedSet;
    }
    const relays = normalizedSet.relays.filter(
      (relay) => relay.url !== 'wss://relay.nostr.band',
    );
    if (relays.length === normalizedSet.relays.length) return normalizedSet;
    changed = true;
    return { ...normalizedSet, relays, updatedAt: Date.now() };
  });
  return changed ? next : [...relaySets];
}
