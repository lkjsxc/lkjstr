// Everything the WM keeps in storage (`layout:*`: the layouts, and each family's workspace), mirrored in memory.
// A controller therefore starts on its saved layout at once, and switching workspaces never draws a default first.
import { LAYOUT_PREFIX, layoutKey } from '../shared/layout-store.ts';
import { kv } from '../shared/storage.ts';
import type { Space } from './spaces.ts';

const SAVE_MS = 400; // a layout changes continuously during a drag

export type WmStore = {
  get(key: string): unknown;
  /** Kept at once, written a moment later. */
  save(key: string, value: unknown): void;
  space(family: string, index: number): Space;
  /** Forgets every saved layout, here and in the other browser tabs. */
  reset(): void;
  dispose(): void;
};

/** A value as text whatever the order of its keys. */
const canon = (value: unknown): string | undefined =>
  JSON.stringify(value, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );

export function createWmStore(): WmStore {
  // Bounds of the four maps: one entry per `layout:*` key (families × (workspaces + 1)).
  const values = new Map<string, unknown>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const written = new Map<string, string>(); // our last write per key, to tell its echo from a foreign change
  const watchers = new Map<string, (value: unknown) => void>();

  const write = (key: string): void => {
    clearTimeout(timers.get(key));
    timers.delete(key);
    written.set(key, JSON.stringify(values.get(key)));
    kv.set(key, values.get(key));
  };
  const flush = (): void => [...timers.keys()].forEach(write);
  const save = (key: string, value: unknown): void => {
    // Nothing new (a page that just loaded saves what it read): writing it would undo another browser tab's change
    // made meanwhile, since a foreign write wins.
    if (canon(value) === canon(values.get(key))) return;
    values.set(key, value);
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => write(key), SAVE_MS),
    );
  };
  /** A change made by another browser tab (or a reset from Settings, through `changed`). */
  const changed = (key: string, value: unknown): void => {
    if (!key.startsWith(LAYOUT_PREFIX)) return;
    clearTimeout(timers.get(key)); // a foreign change wins over ours still pending
    timers.delete(key);
    written.delete(key);
    if (value === undefined) values.delete(key);
    else values.set(key, value);
    watchers.get(key)?.(value);
  };
  const off = kv.onChanged(changed);
  window.addEventListener('pagehide', flush);
  for (const key of kv.keys(LAYOUT_PREFIX)) values.set(key, kv.get(key));

  return {
    get: (key) => values.get(key),
    save,
    space(family, index) {
      const key = layoutKey(family, index);
      return {
        index,
        stored: values.get(key),
        save: (layout) => save(key, layout),
        watch(fn) {
          watchers.set(key, fn);
          return () => void (watchers.get(key) === fn && watchers.delete(key));
        },
      };
    },
    reset() {
      for (const key of [...values.keys()]) kv.remove(key), changed(key, undefined);
    },
    dispose() {
      flush();
      off();
      window.removeEventListener('pagehide', flush);
    },
  };
}
