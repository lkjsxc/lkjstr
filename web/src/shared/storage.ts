// What the UI keeps on this device: settings, layouts and each tab's own state, one JSON value per key under
// `lkjstr:` in localStorage. Reads are synchronous, so the first frame already shows the saved state. A change made
// in another browser tab arrives through `onChanged` (the `storage` event never fires in the tab that wrote).
const PREFIX = 'lkjstr:';
const memory = new Map<string, string>(); // bound: used only when the browser refuses storage; one entry per key

const backend = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage blocked: keep working for this session
  }
};
const parse = (raw: string | null | undefined): unknown => {
  if (raw === null || raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const kv = {
  get(key: string): unknown {
    const s = backend();
    return parse(s ? s.getItem(PREFIX + key) : memory.get(key));
  },
  set(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    try {
      const s = backend();
      if (s) s.setItem(PREFIX + key, raw);
      else memory.set(key, raw);
    } catch {
      memory.set(key, raw); // quota: this session only
    }
  },
  persist(key: string, value: unknown): boolean {
    try {
      const s = backend();
      if (!s) return false;
      const raw = JSON.stringify(value);
      s.setItem(PREFIX + key, raw);
      memory.delete(key);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    backend()?.removeItem(PREFIX + key);
    memory.delete(key);
  },
  keys(prefix = ''): string[] {
    const s = backend();
    const all = s
      ? Array.from({ length: s.length }, (_, i) => s.key(i) ?? '')
          .filter((k) => k.startsWith(PREFIX))
          .map((k) => k.slice(PREFIX.length))
      : [...memory.keys()];
    return all.filter((k) => k.startsWith(prefix));
  },
  /** Changes made by other browser tabs of this origin (`value` is undefined for a removal). */
  onChanged(fn: (key: string, value: unknown) => void): () => void {
    const listener = (e: StorageEvent): void => {
      if (e.key?.startsWith(PREFIX)) fn(e.key.slice(PREFIX.length), parse(e.newValue));
    };
    globalThis.addEventListener('storage', listener);
    return () => globalThis.removeEventListener('storage', listener);
  },
};
