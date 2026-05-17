import { browserDb } from '../storage/browser-db';
import type { RelayConnectionState } from './types';
import { defaultRelaySet } from './default-relays';

export type RelayRecord = {
  readonly url: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly read: boolean;
  readonly write: boolean;
  readonly state: RelayConnectionState;
  readonly lastError?: string;
  readonly lastConnectedAt?: number;
  readonly updatedAt: number;
  readonly health: { attempts: number; successes: number; failures: number };
};

export type RelaySet = {
  readonly id: string;
  readonly name: string;
  readonly seeded: boolean;
  readonly relays: readonly RelayRecord[];
  readonly updatedAt: number;
};

let memoryRelaySets: RelaySet[] = [];

export async function listRelaySets(): Promise<RelaySet[]> {
  const saved = await browserDb()
    .relaySets.toArray()
    .catch(() => memoryRelaySets);
  if (saved.length > 0) return saved;
  const seeded = seedDefaultRelays([]);
  await saveRelaySets(seeded);
  return seeded;
}

export function seedDefaultRelays(existing: readonly RelaySet[]): RelaySet[] {
  if (existing.length > 0) return [...existing];
  return [{ ...defaultRelaySet, updatedAt: Date.now() }];
}

export async function saveRelaySets(
  relaySets: readonly RelaySet[],
): Promise<void> {
  memoryRelaySets = [...relaySets];
  await browserDb()
    .relaySets.bulkPut([...relaySets])
    .catch(() => undefined);
}

export async function removeRelay(
  setId: string,
  url: string,
): Promise<RelaySet[]> {
  const relaySets = await listRelaySets();
  const next = relaySets.map((set) =>
    set.id !== setId
      ? set
      : {
          ...set,
          relays: set.relays.filter((relay) => relay.url !== url),
          updatedAt: Date.now(),
        },
  );
  await saveRelaySets(next);
  return next;
}

export async function setRelayEnabled(
  setId: string,
  url: string,
  enabled: boolean,
): Promise<RelaySet[]> {
  const relaySets = await listRelaySets();
  const next = relaySets.map((set) =>
    set.id !== setId
      ? set
      : {
          ...set,
          relays: set.relays.map((relay) =>
            relay.url === url
              ? { ...relay, enabled, updatedAt: Date.now() }
              : relay,
          ),
        },
  );
  await saveRelaySets(next);
  return next;
}
