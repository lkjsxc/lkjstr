// Small per-tab state of views (what a tab shows, its filter, its reading position), one stored key per instance.
import { kv } from './storage.ts';

const key = (instance: string): string => `view:${instance}`;

export function loadViewState<T extends object>(instance: string): Partial<T> {
  const value = kv.get(key(instance));
  return typeof value === 'object' && value !== null ? (value as Partial<T>) : {};
}

export const saveViewState = (instance: string, state: object): void =>
  kv.set(key(instance), state);

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

export function restoreViewState(instance: string, snapshot: object): void {
  const { tabCompanions, ...state } = snapshot as Snapshot;
  saveViewState(instance, state);
  for (const suffix of companions) {
    const value = tabCompanions?.[suffix];
    if (value) saveViewState(instance + suffix, value);
  }
}

/** A fresh tab releases every input and outbox key owned by its previous occupant. */
export const dropViewState = (instance: string): void => {
  kv.remove(key(instance));
  for (const suffix of companions) kv.remove(key(instance + suffix));
};
