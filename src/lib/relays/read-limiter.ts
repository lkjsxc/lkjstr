import { normalizeRelayUrl } from '../protocol';
import type { RelaySnapshot } from './types';

export type PerRelayReadLimiter = ReturnType<typeof createPerRelayReadLimiter>;

export function createPerRelayReadLimiter(limit: number) {
  const max = Math.max(1, Math.floor(limit));
  const active = new Map<string, number>();
  const queues = new Map<string, (() => void)[]>();

  const acquireOne = (relay: string): Promise<void> => {
    const count = active.get(relay) ?? 0;
    if (count < max) {
      active.set(relay, count + 1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const queue = queues.get(relay) ?? [];
      queue.push(() => {
        active.set(relay, (active.get(relay) ?? 0) + 1);
        resolve();
      });
      queues.set(relay, queue);
    });
  };

  const releaseOne = (relay: string): void => {
    const count = (active.get(relay) ?? 0) - 1;
    if (count > 0) active.set(relay, count);
    else active.delete(relay);
    const queue = queues.get(relay);
    const next = queue?.shift();
    if (!queue || queue.length === 0) queues.delete(relay);
    next?.();
  };

  return {
    acquire: async (relays: readonly string[]): Promise<() => void> => {
      const acquired: string[] = [];
      for (const relay of relays) {
        await acquireOne(relay);
        acquired.push(relay);
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        for (const relay of [...acquired].reverse()) releaseOne(relay);
      };
    },
    activeCount: (relay: string): number => active.get(relay) ?? 0,
  };
}

export function limitedReadRelays(relays: readonly string[]): string[] {
  return [
    ...new Set(
      relays
        .map(normalizeRelayUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ].sort();
}

export function readPageComplete(
  snapshots: readonly RelaySnapshot[],
  relays: readonly string[],
  subId: string,
): boolean {
  const relaySet = new Set(limitedReadRelays(relays));
  const active = snapshots.filter((item) => {
    const url = normalizeRelayUrl(item.url);
    return url ? relaySet.has(url) : false;
  });
  return (
    active.length > 0 &&
    active.every(
      (item) =>
        item.eoseBySub[subId] ||
        item.closedBySub[subId] ||
        item.state === 'closed' ||
        item.state === 'error',
    )
  );
}
