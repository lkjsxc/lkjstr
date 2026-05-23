import { normalizeRelayUrl } from '../protocol';
import { listRelaySets, saveRelaySets, type RelaySet } from './relay-store';

export type RelayHealthEvidence = {
  readonly attempted?: boolean;
  readonly connectedAt?: number;
  readonly failure?: string;
  readonly lastError?: string;
};

export async function recordRelayHealthEvidence(
  inputUrl: string,
  evidence: RelayHealthEvidence,
): Promise<RelaySet[]> {
  const url = normalizeRelayUrl(inputUrl);
  if (!url) return listRelaySets();
  const now = Date.now();
  const relaySets = await listRelaySets();
  let changed = false;
  const next = relaySets.map((set) => updateSetHealth(set, url, evidence, now));
  changed = next.some((set, index) => set !== relaySets[index]);
  if (changed) await saveRelaySets(next);
  return changed ? next : relaySets;
}

function updateSetHealth(
  set: RelaySet,
  url: string,
  evidence: RelayHealthEvidence,
  now: number,
): RelaySet {
  let changed = false;
  const relays = set.relays.map((relay) => {
    if (!relay.enabled || normalizeRelayUrl(relay.url) !== url) return relay;
    changed = true;
    return {
      ...relay,
      updatedAt: now,
      lastConnectedAt: evidence.connectedAt ?? relay.lastConnectedAt,
      lastError: evidence.failure ?? evidence.lastError ?? relay.lastError,
      health: {
        attempts: relay.health.attempts + (evidence.attempted ? 1 : 0),
        successes: relay.health.successes + (evidence.connectedAt ? 1 : 0),
        failures: relay.health.failures + (evidence.failure ? 1 : 0),
      },
    };
  });
  return changed ? { ...set, relays, updatedAt: now } : set;
}
