import { safeGetItem, safeSetItem } from '../storage/safe-storage';
import {
  putRelaySetRows,
  readRelaySetRows,
} from '../storage/repositories/relay-sets-store';
import { defaultDiscoveryRelaySet, defaultRelaySet } from './default-relays';
import { normalizeRelayUrl } from '../protocol';
import { normalizeSeededRelaySets } from './relay-normalize';
import { clearRouteBlock, saveRouteBlock } from './relay-route-store';
import { createRelay, resetRelayLiveState } from './relay-store-helpers';
import type { RelayPurpose } from './relay-purpose';
import type { RelayRecord, RelaySet } from './relay-types';
export type { RelayRecord, RelaySet } from './relay-types';
const selectedDefaultKey = 'lkjstr.defaultRelaySetId';
let memorySelectedDefaultRelaySetId = defaultRelaySet.id;

let memoryRelaySets: RelaySet[] = [];

export async function listRelaySets(): Promise<RelaySet[]> {
  const saved = await readRelaySetRows(memoryRelaySets);
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
    userRelaySets(relaySets).find(
      (set) => set.id === selectedDefaultRelaySetId(),
    ) ?? userRelaySets(relaySets)[0]
  );
}

export function seedDefaultRelays(existing: readonly RelaySet[]): RelaySet[] {
  if (existing.length > 0) return normalizeSeededRelaySets(existing);
  const updatedAt = Date.now();
  return [
    { ...defaultRelaySet, updatedAt },
    { ...defaultDiscoveryRelaySet, updatedAt },
  ];
}

export async function saveRelaySets(
  relaySets: readonly RelaySet[],
): Promise<void> {
  memoryRelaySets = [...relaySets];
  await putRelaySetRows(relaySets);
}

export async function addRelay(
  setId: string,
  input: string,
): Promise<RelaySet[]> {
  const url = normalizeRelayUrl(input);
  if (!url) throw new Error('Relay URL is invalid.');
  await clearRouteBlock(url, setPurpose(await listRelaySets(), setId));
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
  return updateSet(setId, async (set) => {
    if (patch.enabled === true) await clearRouteBlock(url, set.purpose);
    if (patch.enabled === false)
      await saveRouteBlock(url, 'user-disabled', set.purpose);
    return {
      ...set,
      relays: set.relays.map((relay) =>
        relay.url === url
          ? { ...relay, ...patch, updatedAt: Date.now() }
          : relay,
      ),
    };
  });
}

export async function restoreDefaultRelaySet(
  purpose: RelayPurpose = 'user',
): Promise<RelaySet[]> {
  const sets = await listRelaySets();
  const defaults =
    purpose === 'user' ? defaultRelaySet : defaultDiscoveryRelaySet;
  await Promise.all(
    defaults.relays.map((relay) => clearRouteBlock(relay.url, purpose)),
  );
  const next = [
    ...sets.filter((set) => set.id !== defaults.id),
    { ...defaults, updatedAt: Date.now() },
  ];
  await saveRelaySets(next);
  return next;
}

export async function removeRelay(
  setId: string,
  url: string,
): Promise<RelaySet[]> {
  const relaySets = await listRelaySets();
  await saveRouteBlock(url, 'user-removed', setPurpose(relaySets, setId));
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
  const purpose = setPurpose(relaySets, setId);
  if (enabled) await clearRouteBlock(url, purpose);
  else await saveRouteBlock(url, 'user-disabled', purpose);
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
  update: (set: RelaySet) => RelaySet | Promise<RelaySet>,
): Promise<RelaySet[]> {
  const next: RelaySet[] = [];
  for (const set of await listRelaySets())
    next.push(
      set.id === setId
        ? { ...(await update(set)), updatedAt: Date.now() }
        : set,
    );
  await saveRelaySets(next);
  return next;
}

function setPurpose(
  relaySets: readonly RelaySet[],
  setId: string,
): RelayPurpose {
  return relaySets.find((set) => set.id === setId)?.purpose ?? 'user';
}

function userRelaySets(relaySets: readonly RelaySet[]): RelaySet[] {
  return relaySets.filter((set) => set.purpose === 'user');
}
