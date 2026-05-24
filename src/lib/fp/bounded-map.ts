export type BoundedMapOptions = {
  readonly maxSize: number;
  readonly ttlMs?: number;
};

type Entry<V> = {
  readonly value: V;
  readonly expiresAt?: number;
};

export type BoundedMap<K, V> = {
  readonly size: () => number;
  readonly get: (key: K) => V | undefined;
  readonly set: (key: K, value: V) => void;
  readonly delete: (key: K) => boolean;
  readonly clear: () => void;
  readonly values: () => V[];
  readonly entries: () => [K, V][];
};

export function createBoundedMap<K, V>(
  options: BoundedMapOptions,
): BoundedMap<K, V> {
  const maxSize = Math.max(1, Math.floor(options.maxSize));
  const ttlMs = options.ttlMs && options.ttlMs > 0 ? options.ttlMs : undefined;
  const entries = new Map<K, Entry<V>>();

  const prune = (now = Date.now()) => {
    if (ttlMs) {
      for (const [key, entry] of entries) {
        if ((entry.expiresAt ?? Number.POSITIVE_INFINITY) <= now)
          entries.delete(key);
      }
    }
    while (entries.size > maxSize) {
      const oldest = entries.keys().next().value as K | undefined;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  return {
    size: () => {
      prune();
      return entries.size;
    },
    get: (key) => {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if ((entry.expiresAt ?? Number.POSITIVE_INFINITY) <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set: (key, value) => {
      entries.delete(key);
      entries.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      });
      prune();
    },
    delete: (key) => entries.delete(key),
    clear: () => entries.clear(),
    values: () => {
      prune();
      return [...entries.values()].map((entry) => entry.value);
    },
    entries: () => {
      prune();
      return [...entries.entries()].map(([key, entry]) => [key, entry.value]);
    },
  };
}
