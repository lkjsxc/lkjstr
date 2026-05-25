import type { BoundedMap } from '../fp/bounded-map';
import { decMemoryCounter } from '../app/memory-counters';
import type { RelayClient } from './relay-client';
import type { RelaySnapshot } from './types';

type RelayPoolIdleOptions = {
  readonly clients: Map<string, RelayClient>;
  readonly snapshots: BoundedMap<string, RelaySnapshot>;
  readonly idleGraceMs: number;
  readonly onChange: () => void;
};

export function createRelayPoolIdleTracker(options: RelayPoolIdleOptions) {
  const active = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const begin = (url: string): void => {
    clearIdleTimer(url);
    active.set(url, (active.get(url) ?? 0) + 1);
  };
  const end = (url: string): void => {
    const next = Math.max(0, (active.get(url) ?? 0) - 1);
    if (next > 0) {
      active.set(url, next);
      return;
    }
    active.delete(url);
    scheduleIdle(url);
  };
  const scheduleIdle = (url: string): void => {
    if (!options.clients.has(url) || timers.has(url)) return;
    timers.set(
      url,
      setTimeout(() => {
        timers.delete(url);
        if (active.has(url)) return;
        const client = options.clients.get(url);
        if (!client) return;
        options.snapshots.set(url, client.snapshot());
        client.close();
        options.snapshots.set(url, client.snapshot());
        options.clients.delete(url);
        decMemoryCounter('active-relay-clients');
        options.onChange();
      }, options.idleGraceMs),
    );
  };
  const clearIdleTimer = (url: string): void => {
    const timer = timers.get(url);
    if (!timer) return;
    clearTimeout(timer);
    timers.delete(url);
  };
  return {
    begin,
    end,
    clientCount: () => options.clients.size,
    clear: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      active.clear();
    },
  };
}
