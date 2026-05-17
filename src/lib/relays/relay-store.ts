import { browserDb } from '../storage/browser-db';
import type { RelayConnectionState } from './types';
import { defaultRelaySet } from './default-relays';
import { normalizeRelayUrl } from '../protocol';

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

export async function addRelay(
  setId: string,
  input: string,
): Promise<RelaySet[]> {
  const url = normalizeRelayUrl(input);
  if (!url) throw new Error('Relay URL is invalid.');
  return updateSet(setId, (set) =>
    set.relays.some((relay) => relay.url === url)
      ? set
      : { ...set, relays: [...set.relays, createRelay(url)] },
  );
}

export async function updateRelay(
  setId: string,
  url: string,
  patch: Partial<Pick<RelayRecord, 'label' | 'enabled' | 'read' | 'write'>>,
): Promise<RelaySet[]> {
  return updateSet(setId, (set) => ({
    ...set,
    relays: set.relays.map((relay) =>
      relay.url === url ? { ...relay, ...patch, updatedAt: Date.now() } : relay,
    ),
  }));
}

export async function restoreDefaultRelaySet(): Promise<RelaySet[]> {
  const sets = await listRelaySets();
  const next = [
    ...sets.filter((set) => set.id !== defaultRelaySet.id),
    { ...defaultRelaySet, updatedAt: Date.now() },
  ];
  await saveRelaySets(next);
  return next;
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

async function updateSet(
  setId: string,
  update: (set: RelaySet) => RelaySet,
): Promise<RelaySet[]> {
  const next = (await listRelaySets()).map((set) =>
    set.id === setId ? { ...update(set), updatedAt: Date.now() } : set,
  );
  await saveRelaySets(next);
  return next;
}

function createRelay(url: string): RelayRecord {
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
