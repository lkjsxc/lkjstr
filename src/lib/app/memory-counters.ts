export type MemoryCounterKey =
  | 'active-relay-clients'
  | 'active-relay-subscriptions'
  | 'active-relay-publish-waiters'
  | 'pending-relay-send-queue'
  | 'pending-relay-request-queue'
  | 'active-paged-reads'
  | 'queued-read-waiters'
  | 'active-abort-listeners'
  | 'active-dom-listeners'
  | 'active-timers'
  | 'active-workers'
  | 'active-indexeddb-ops'
  | 'active-dexie-transactions'
  | 'active-tab-runtimes'
  | 'closed-tab-snapshots'
  | 'feed-runtime-window-size'
  | 'relay-diagnostic-summary-count'
  | 'profile-summary-cache-count'
  | 'token-cache-count'
  | 'notification-runtime-record-count';

const memoryCounterKeys: readonly MemoryCounterKey[] = [
  'active-relay-clients',
  'active-relay-subscriptions',
  'active-relay-publish-waiters',
  'pending-relay-send-queue',
  'pending-relay-request-queue',
  'active-paged-reads',
  'queued-read-waiters',
  'active-abort-listeners',
  'active-dom-listeners',
  'active-timers',
  'active-workers',
  'active-indexeddb-ops',
  'active-dexie-transactions',
  'active-tab-runtimes',
  'closed-tab-snapshots',
  'feed-runtime-window-size',
  'relay-diagnostic-summary-count',
  'profile-summary-cache-count',
  'token-cache-count',
  'notification-runtime-record-count',
];

const counters = new Map<MemoryCounterKey, number>();

export function setMemoryCounter(key: MemoryCounterKey, value: number): void {
  counters.set(key, Math.max(0, Math.floor(value)));
}

export function incMemoryCounter(key: MemoryCounterKey, delta = 1): void {
  counters.set(key, (counters.get(key) ?? 0) + Math.max(0, Math.floor(delta)));
}

export function decMemoryCounter(key: MemoryCounterKey, delta = 1): void {
  counters.set(
    key,
    Math.max(0, (counters.get(key) ?? 0) - Math.max(0, Math.floor(delta))),
  );
}

export function getMemoryCounter(key: MemoryCounterKey): number {
  return counters.get(key) ?? 0;
}

export function getMemoryCounterSnapshot(): Record<MemoryCounterKey, number> {
  const snapshot = {} as Record<MemoryCounterKey, number>;
  for (const key of memoryCounterKeys) {
    snapshot[key] = counters.get(key) ?? 0;
  }
  return snapshot;
}

export function getMemoryCounterTotal(): number {
  let total = 0;
  for (const key of memoryCounterKeys) {
    total += counters.get(key) ?? 0;
  }
  return total;
}

export function resetMemoryCounters(): void {
  counters.clear();
}
