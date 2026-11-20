// Small per-tab state of views (what a tab shows, its filter, its reading position), one stored key per instance.
import { kv } from './storage.ts';

const key = (instance: string): string => `view:${instance}`;

export function loadViewState<T extends object>(instance: string): Partial<T> {
  const value = kv.get(key(instance));
  return typeof value === 'object' && value !== null ? (value as Partial<T>) : {};
}

const merged = (instance: string, state: object): object => {
  const saved = loadViewState<{
    reader: unknown;
    scroll: unknown;
    drafts: unknown;
    channelEdit: unknown;
  }>(instance);
  // These independently owned slices cannot be overwritten by a view's older snapshot.
  return {
    ...state,
    ...(saved.reader ? { reader: saved.reader } : {}),
    ...(saved.scroll ? { scroll: saved.scroll } : {}),
    ...(saved.drafts ? { drafts: saved.drafts } : {}),
    ...(saved.channelEdit ? { channelEdit: saved.channelEdit } : {}),
  };
};
export const saveViewState = (instance: string, state: object): void =>
  kv.set(key(instance), merged(instance, state));

export const saveViewSlice = (
  instance: string,
  slice: 'reader' | 'scroll' | 'drafts' | 'channelEdit',
  value: unknown,
): void => kv.set(key(instance), { ...loadViewState(instance), [slice]: value });

// Bound: the three companion keys owned by a Post or channel tab.
const companions = [':say', ':outbox', ':say:outbox'] as const;
type Snapshot = { tabCompanions?: Partial<Record<(typeof companions)[number], object>> };

/** Closed tabs carry their input and independent outboxes, including a channel's composer. */
export function snapshotViewState(instance: string): object {
  const tabCompanions: Snapshot['tabCompanions'] = {};
  for (const suffix of companions) {
    const value = kv.get(key(instance + suffix));
    if (typeof value === 'object' && value !== null) tabCompanions[suffix] = value;
  }
  return { ...loadViewState(instance), tabCompanions };
}

/** False when the device had no room for all of it (what was written then stays, harmlessly, under a closed id). */
export function restoreViewState(instance: string, snapshot: object): boolean {
  const { tabCompanions, __say, ...state } = snapshot as Snapshot & { __say?: object };
  const writes: [string, object][] = [[instance, state]];
  if (__say && typeof __say === 'object') writes.push([`${instance}:say`, __say]);
  for (const suffix of companions) {
    const value = tabCompanions?.[suffix];
    if (value) writes.push([instance + suffix, value]);
  }
  return writes.every(([at, value]) => kv.durably(key(at), merged(at, value)));
}

/** A fresh tab releases every input and outbox key owned by its previous occupant. */
export const dropViewState = (instance: string): void => {
  kv.remove(key(instance));
  for (const suffix of companions) kv.remove(key(instance + suffix));
};
