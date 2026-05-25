import { sharedRelayPool, type PoolEvent, type RelayPool } from './relay-pool';
import type { RelayReadRequest } from '../events/types';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import { countRuntime } from '../app/runtime-counters';
import type { RelaySnapshot } from './types';
import type { ReadPageResult } from './read-page-status';
import { createPerRelayReadLimiter } from './read-limiter';
import { compactRelaySubscriptionId } from './subscription-id';
import { normalizedRelayList } from './relay-url-list';
import { executeReadPage, type ReadPageState } from './subscription-read-page';
import {
  normalizeSnapshots,
  safeNotify,
  type SubscriptionEntry,
  type SubscriptionListener,
} from './subscription-manager-events';
import {
  createSharedAbortController,
  type SharedAbortController,
} from './shared-abort-controller';

type Listener = SubscriptionListener;
type Entry = SubscriptionEntry;
type InFlightRead = {
  readonly promise: Promise<ReadPageResult>;
  readonly aborts: SharedAbortController;
};

export type ReadPageOptions = {
  readonly timeoutMs?: number;
  readonly maxEvents?: number;
  readonly signal?: AbortSignal;
};

export const defaultReadPageMaxEvents = 1000;

export type RelaySubscriptionManagerOptions = {
  readonly maxConcurrentReadPagesPerRelay?: number;
};

export type RelaySubscriptionManager = ReturnType<
  typeof createRelaySubscriptionManager
>;

export function createRelaySubscriptionManager(
  pool: RelayPool = sharedRelayPool,
  options: RelaySubscriptionManagerOptions = {},
) {
  const entries = new Map<string, Entry>();
  const readLimiter = createPerRelayReadLimiter(
    options.maxConcurrentReadPagesPerRelay ?? 1,
  );
  const readState: ReadPageState = {
    readSeq: 0,
    activeRelaySubIds: new Set<string>(),
  };
  const inFlightReads = new Map<string, InFlightRead>();
  let closed = false;

  const remove = (key: string, listener: Listener): void => {
    const entry = entries.get(key);
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0) return;
    entry.cleanup();
    entries.delete(key);
  };
  const manager = {
    subscribeLive: (
      request: RelayReadRequest,
      listener: Listener,
    ): (() => void) => {
      if (closed) return () => undefined;
      const safeRequest = relaySafeReadRequest(request);
      const key = subscriptionKey(safeRequest);
      const existing = entries.get(key);
      if (existing) {
        existing.listeners.add(listener);
        return () => remove(key, listener);
      }
      const listeners = new Set<Listener>([listener]);
      const subId = relayFacingSubId(safeRequest.key);
      const offEvent = pool.onEvent((event) => {
        if (event.subId !== subId) return;
        listeners.forEach((item) =>
          safeNotify(item, { ...event, subId: request.key }, request.key),
        );
        countRuntime('subscription-manager', 'events');
      });
      const close = pool.subscribe(
        safeRequest.relays,
        subId,
        safeRequest.filters,
        { purpose: safeRequest.purpose, strategy: 'forward' },
      );
      entries.set(key, {
        subId,
        key: request.key,
        listeners,
        cleanup: () => {
          offEvent();
          close();
        },
      });
      return () => remove(key, listener);
    },
    subscribeState: (
      listener: (snapshots: RelaySnapshot[]) => void,
    ): (() => void) =>
      pool.onState((snapshots) =>
        listener(normalizeSnapshots(snapshots, [...entries.values()])),
      ),
    readPage: async (
      request: RelayReadRequest,
      options: ReadPageOptions = {},
    ): Promise<PoolEvent[]> =>
      (await manager.readPageDetailed(request, options)).events,
    readPageDetailed: (
      request: RelayReadRequest,
      options: ReadPageOptions = {},
    ): Promise<ReadPageResult> => {
      if (closed) return Promise.resolve({ events: [], statuses: [] });
      const safeRequest = relaySafeReadRequest(request);
      const dedupeKey = readDedupeKey(safeRequest, options);
      const existing = inFlightReads.get(dedupeKey);
      if (existing) {
        existing.aborts.attachSignal(options.signal);
        return existing.promise;
      }
      const aborts = createSharedAbortController();
      aborts.attachSignal(options.signal);
      const promise = executeReadPage(
        pool,
        readLimiter,
        readState,
        safeRequest,
        {
          ...options,
          signal: aborts.signal,
        },
      ).finally(() => {
        aborts.detachSignals();
        inFlightReads.delete(dedupeKey);
      });
      inFlightReads.set(dedupeKey, { promise, aborts });
      countRuntime('subscription-manager', 'pageReads');
      return promise;
    },
    close: (): void => {
      if (closed) return;
      closed = true;
      for (const read of inFlightReads.values()) {
        read.aborts.abort();
        read.aborts.detachSignals();
      }
      inFlightReads.clear();
      readLimiter.close();
      for (const entry of entries.values()) entry.cleanup();
      entries.clear();
    },
    counts: () => ({
      liveSubscriptions: entries.size,
      liveListeners: [...entries.values()].reduce(
        (sum, entry) => sum + entry.listeners.size,
        0,
      ),
      inFlightReads: inFlightReads.size,
    }),
  };
  return manager;
}

export function subscriptionKey(request: RelayReadRequest): string {
  return JSON.stringify({
    key: request.key,
    relays: normalizedRelayList(request.relays),
    filters: relaySafeFilters(request.filters),
    purpose: request.purpose,
  });
}

export function relayFacingSubId(key: string): string {
  return compactRelaySubscriptionId('read', 'sub', key);
}

export const sharedSubscriptionManager = createRelaySubscriptionManager();

function readDedupeKey(
  request: RelayReadRequest,
  options: ReadPageOptions,
): string {
  return JSON.stringify({
    request: subscriptionKey(request),
    timeoutMs: options.timeoutMs ?? 5000,
    maxEvents: options.maxEvents ?? defaultReadPageMaxEvents,
  });
}

// prettier-ignore
function relaySafeReadRequest(request: RelayReadRequest): RelayReadRequest { return { ...request, filters: relaySafeFilters(request.filters) }; }
