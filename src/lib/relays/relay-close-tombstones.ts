export type RelayCloseTombstones = ReturnType<
  typeof createRelayCloseTombstones
>;

export function createRelayCloseTombstones(ttlMs = 10_000, maxSize = 256) {
  const expiresById = new Map<string, number>();

  const prune = (now = Date.now()) => {
    for (const [id, expiresAt] of expiresById)
      if (expiresAt <= now) expiresById.delete(id);
    while (expiresById.size > maxSize) {
      const oldest = expiresById.keys().next().value as string | undefined;
      if (!oldest) break;
      expiresById.delete(oldest);
    }
  };

  return {
    record: (ids: readonly string[], now = Date.now()): void => {
      prune(now);
      for (const id of ids) expiresById.set(id, now + ttlMs);
      prune(now);
    },
    hasAny: (ids: readonly string[], now = Date.now()): boolean => {
      prune(now);
      return ids.some((id) => expiresById.has(id));
    },
    clear: (): void => {
      expiresById.clear();
    },
  };
}
