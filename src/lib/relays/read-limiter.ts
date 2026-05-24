import { normalizeRelayUrl } from '../protocol';
import type { RelaySnapshot } from './types';

export type PerRelayReadLimiter = ReturnType<typeof createPerRelayReadLimiter>;

export function createPerRelayReadLimiter(limit: number) {
  const max = Math.max(1, Math.floor(limit));
  const active = new Map<string, number>();
  type Waiter = {
    readonly resolve: () => void;
    readonly reject: (error: Error) => void;
    readonly abort: () => void;
  };
  const queues = new Map<string, Waiter[]>();

  const acquireOne = (relay: string, signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) return Promise.reject(abortError());
    const count = active.get(relay) ?? 0;
    if (count < max) {
      active.set(relay, count + 1);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const queue = queues.get(relay) ?? [];
      const waiter = {
        resolve: () => {
          signal?.removeEventListener('abort', waiter.abort);
          active.set(relay, (active.get(relay) ?? 0) + 1);
          resolve();
        },
        reject,
        abort: () => {
          removeWaiter(relay, waiter);
          reject(abortError());
        },
      };
      queue.push(waiter);
      signal?.addEventListener('abort', waiter.abort, { once: true });
      queues.set(relay, queue);
    });
  };

  const removeWaiter = (relay: string, waiter: Waiter): void => {
    const queue = queues.get(relay);
    if (!queue) return;
    const next = queue.filter((item) => item !== waiter);
    if (next.length > 0) queues.set(relay, next);
    else queues.delete(relay);
  };

  const activateNext = (relay: string): void => {
    const queue = queues.get(relay);
    const next = queue?.shift();
    if (!queue || queue.length === 0) queues.delete(relay);
    next?.resolve();
  };

  const failQueues = (): void => {
    for (const queue of queues.values()) {
      for (const waiter of queue) {
        waiter.reject(abortError());
      }
    }
    queues.clear();
  };

  const releaseOne = (relay: string): void => {
    const count = (active.get(relay) ?? 0) - 1;
    if (count > 0) active.set(relay, count);
    else active.delete(relay);
    activateNext(relay);
  };

  return {
    acquire: async (
      relays: readonly string[],
      signal?: AbortSignal,
    ): Promise<() => void> => {
      const acquired: string[] = [];
      try {
        for (const relay of relays) {
          await acquireOne(relay, signal);
          acquired.push(relay);
        }
      } catch (error) {
        for (const relay of [...acquired].reverse()) releaseOne(relay);
        throw error;
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        for (const relay of [...acquired].reverse()) releaseOne(relay);
      };
    },
    close: (): void => failQueues(),
    activeCount: (relay: string): number => active.get(relay) ?? 0,
    queuedCount: (relay: string): number => queues.get(relay)?.length ?? 0,
  };
}

function abortError(): Error {
  const error = new Error('read aborted');
  error.name = 'AbortError';
  return error;
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
