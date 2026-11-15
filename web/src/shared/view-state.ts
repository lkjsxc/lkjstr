// Small per-tab state of views (what a tab shows, its filter, its reading position), one stored key per instance.
import { kv } from './storage.ts';

const key = (instance: string): string => `view:${instance}`;

export function loadViewState<T extends object>(instance: string): Partial<T> {
  const value = kv.get(key(instance));
  return typeof value === 'object' && value !== null ? (value as Partial<T>) : {};
}

export const saveViewState = (instance: string, state: object): void => {
  const saved = loadViewState<{
    reader: unknown;
    scroll: unknown;
    drafts: unknown;
    channelEdit: unknown;
  }>(instance);
  // These independently owned slices cannot be overwritten by a view's older snapshot.
  kv.set(key(instance), {
    ...state,
    ...(saved.reader ? { reader: saved.reader } : {}),
    ...(saved.scroll ? { scroll: saved.scroll } : {}),
    ...(saved.drafts ? { drafts: saved.drafts } : {}),
    ...(saved.channelEdit ? { channelEdit: saved.channelEdit } : {}),
  });
};

export const saveViewSlice = (
  instance: string,
  slice: 'reader' | 'scroll' | 'drafts' | 'channelEdit',
  value: unknown,
): void => kv.set(key(instance), { ...loadViewState(instance), [slice]: value });

/** A tab's state goes with the tab, and with it the draft of a composer inside it (`<instance>:say`). */
export const dropViewState = (instance: string): void => {
  kv.remove(key(instance));
  kv.remove(key(`${instance}:say`));
};

/** Snapshot the embedded channel composer with its owner when closing a tab. */
export function snapshotViewState(instance: string): object {
  const state = loadViewState(instance);
  const say = loadViewState(`${instance}:say`);
  return { ...state, __say: Object.keys(say).length ? say : undefined };
}
export function restoreViewState(instance: string, snapshot: object): void {
  const { __say, ...state } = snapshot as Record<string, unknown>;
  saveViewState(instance, state);
  if (__say && typeof __say === 'object') saveViewState(`${instance}:say`, __say);
}
