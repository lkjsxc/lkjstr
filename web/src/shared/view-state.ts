// Small per-tab state of views (what a tab shows, its filter, its reading position), one stored key per instance.
import { kv } from './storage.ts';

const key = (instance: string): string => `view:${instance}`;

export function loadViewState<T extends object>(instance: string): Partial<T> {
  const value = kv.get(key(instance));
  return typeof value === 'object' && value !== null ? (value as Partial<T>) : {};
}

export const saveViewState = (instance: string, state: object): void =>
  kv.set(key(instance), state);

/** A tab's state goes with the tab, and with it the draft of a composer inside it (`<instance>:say`). */
export const dropViewState = (instance: string): void => {
  kv.remove(key(instance));
  kv.remove(key(`${instance}:say`));
};
