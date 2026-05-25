import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  safeGetItem,
  safeSetItem,
} from '../storage/safe-storage';
import type { RelayConnectionState } from './types';
import { defaultRelaySet } from './default-relays';
import { normalizeRelayUrl } from '../protocol';
import { normalizeSeededRelaySets } from './relay-normalize';
import { clearRouteBlock, saveRouteBlock } from './relay-route-store';
import { createRelay, resetRelayLiveState } from './relay-store-helpers';
const selectedDefaultKey = 'lkjstr.defaultRelaySetId';
let memorySelectedDefaultRelaySetId = defaultRelaySet.id;

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
  readonly isDefault?: boolean;
  readonly seeded: boolean;
  readonly relays: readonly RelayRecord[];
  readonly updatedAt: number;
};

let memoryRelaySets: RelaySet[] = [];

export async function listRelaySets(): Promise<RelaySet[]> {
  const saved = await boundedStorageRead(
    () =>
      browserDb().relaySets.orderBy('updatedAt').reverse().limit(100).toArray(),
    memoryRelaySets,
  );
  if (saved.length > 0) {
    const normalized = normalizeSeededRelaySets(saved);
    const reset = resetRelayLiveState(normalized);
    if (normalized !== saved || reset !== normalized)
      await saveRelaySets(reset);
    return reset;
  }
  const seeded = seedDefaultRelays([]);
  await saveRelaySets(seeded);
  return seeded;
}

export function selectedDefaultRelaySetId(): string {
  return safeGetItem(selectedDefaultKey) ?? memorySelectedDefaultRelaySetId;
}

export function setDefaultRelaySetId(setId: string): void {
  memorySelectedDefaultRelaySetId = setId;
  safeSetItem(selectedDefaultKey, setId);
}

export function selectedDefaultRelaySet(
  relaySets: readonly RelaySet[],
): RelaySet | undefined {
  return (
    relaySets.find((set) => set.id === selectedDefaultRelaySetId()) ??
    relaySets[0]
  );
}

export function seedDefaultRelays(existing: readonly RelaySet[]): RelaySet[] {
  if (existing.length > 0) return normalizeSeededRelaySets(existing);
  return [{ ...defaultRelaySet, updatedAt: Date.now() }];
}

export async function saveRelaySets(
  relaySets: readonly RelaySet[],
): Promise<void> {
  memoryRelaySets = [...relaySets];
  await bestEffortStorageWrite(() =>
    browserDb().relaySets.bulkPut([...relaySets]),
  );
}

export async function addRelay(
  setId: string,
  input: string,
): Promise<RelaySet[]> {
  const url = normalizeRelayUrl(input);
  if (!url) throw new Error('Relay URL is invalid.');
  await clearRouteBlock(url);
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
  if (patch.enabled === true) await clearRouteBlock(url);
  if (patch.enabled === false) await saveRouteBlock(url, 'user-disabled');
  return updateSet(setId, (set) => ({
    ...set,
    relays: set.relays.map((relay) =>
      relay.url === url ? { ...relay, ...patch, updatedAt: Date.now() } : relay,
    ),
  }));
}

export async function restoreDefaultRelaySet(): Promise<RelaySet[]> {
  const sets = await listRelaySets();
  await Promise.all(
    defaultRelaySet.relays.map((relay) => clearRouteBlock(relay.url)),
  );
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
  await saveRouteBlock(url, 'user-removed');
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
  if (enabled) await clearRouteBlock(url);
  else await saveRouteBlock(url, 'user-disabled');
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
