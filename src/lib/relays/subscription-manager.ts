import { sharedRelayPool, type PoolEvent, type RelayPool } from './relay-pool';
import type { RelayReadRequest } from '../events/types';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import { appendAppLog, boundedMessage } from '../log/app-log';
import { countRuntime } from '../app/runtime-counters';
import type { RelaySnapshot } from './types';
import type { ReadPageResult } from './read-page-status';
import { PerRelayReadLimiter } from './read-limiter';
import { compactRelaySubscriptionId } from './subscription-id';
import { normalizedRelayList } from './relay-url-list';
import { executeReadPage, type ReadPageState } from './subscription-read-page';

type Listener = (event: PoolEvent) => void;
type Entry = {
  readonly subId: string;
  readonly key: string;
  readonly listeners: Set<Listener>;
  readonly cleanup: () => void;
};

export type ReadPageOptions = {
  readonly timeoutMs?: number;
};

export type RelaySubscriptionManagerOptions = {
  readonly maxConcurrentReadPagesPerRelay?: number;
};

export class RelaySubscriptionManager {
  #entries = new Map<string, Entry>();
  #pool: RelayPool;
  #readLimiter: PerRelayReadLimiter;
  #readState: ReadPageState = {
    readSeq: 0,
    activeReadBaseIds: new Set<string>(),
    usedReadRequestKeys: new Set<string>(),
    usedReadBaseIds: new Set<string>(),
  };
  #inFlightReads = new Map<string, Promise<ReadPageResult>>();

  constructor(
    pool: RelayPool = sharedRelayPool,
    options: RelaySubscriptionManagerOptions = {},
  ) {
    this.#pool = pool;
    this.#readLimiter = new PerRelayReadLimiter(
      options.maxConcurrentReadPagesPerRelay ?? 1,
    );
  }

  subscribeLive(request: RelayReadRequest, listener: Listener): () => void {
    const safeRequest = relaySafeReadRequest(request);
    const key = subscriptionKey(safeRequest);
    const existing = this.#entries.get(key);
    if (existing) {
      existing.listeners.add(listener);
      return () => this.#remove(key, listener);
    }
    const listeners = new Set<Listener>([listener]);
    const subId = relayFacingSubId(safeRequest.key);
    const offEvent = this.#pool.onEvent((event) => {
      if (event.subId === subId)
        listeners.forEach((item) =>
          safeNotify(item, { ...event, subId: request.key }, request.key),
        );
      if (event.subId === subId) countRuntime('subscription-manager', 'events');
    });
    const close = this.#pool.subscribe(
      safeRequest.relays,
      subId,
      safeRequest.filters,
      safeRequest.purpose,
    );
    this.#entries.set(key, {
      subId,
      key: request.key,
      listeners,
      cleanup: () => {
        offEvent();
        close();
      },
    });
    return () => this.#remove(key, listener);
  }

  subscribeState(listener: (snapshots: RelaySnapshot[]) => void): () => void {
    return this.#pool.onState((snapshots) =>
      listener(normalizeSnapshots(snapshots, [...this.#entries.values()])),
    );
  }

  async readPage(
    request: RelayReadRequest,
    options: ReadPageOptions = {},
  ): Promise<PoolEvent[]> {
    return (await this.readPageDetailed(request, options)).events;
  }

  async readPageDetailed(
    request: RelayReadRequest,
    options: ReadPageOptions = {},
  ): Promise<ReadPageResult> {
    const safeRequest = relaySafeReadRequest(request);
    const dedupeKey = readDedupeKey(safeRequest, options);
    const existing = this.#inFlightReads.get(dedupeKey);
    if (existing) return existing;
    const promise = executeReadPage(
      this.#pool,
      this.#readLimiter,
      this.#readState,
      safeRequest,
      options,
    ).finally(() => this.#inFlightReads.delete(dedupeKey));
    this.#inFlightReads.set(dedupeKey, promise);
    countRuntime('subscription-manager', 'pageReads');
    return promise;
  }

  #remove(key: string, listener: Listener): void {
    const entry = this.#entries.get(key);
    if (!entry) return;
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0) return;
    entry.cleanup();
    this.#entries.delete(key);
  }
}

function safeNotify(listener: Listener, event: PoolEvent, subId: string): void {
  try {
    void Promise.resolve(listener(event)).catch((error) =>
      logListenerFailure(error, subId, event.relay),
    );
  } catch (error) {
    logListenerFailure(error, subId, event.relay);
  }
}

function logListenerFailure(
  error: unknown,
  subId: string,
  relay: string,
): void {
  appendAppLog({
    area: 'subscription',
    severity: 'error',
    code: 'listener-failed',
    message: boundedMessage(error),
    context: { subId, relay },
  });
}

function normalizeSnapshots(
  snapshots: readonly RelaySnapshot[],
  entries: readonly Entry[],
): RelaySnapshot[] {
  const logicalByRelay = new Map(entries.map((entry) => [entry.subId, entry]));
  return snapshots.map((snapshot) => {
    const eoseBySub = { ...snapshot.eoseBySub };
    const closedBySub = { ...snapshot.closedBySub };
    for (const [relaySubId, entry] of logicalByRelay) {
      if (snapshot.eoseBySub[relaySubId]) eoseBySub[entryKey(entry)] = true;
      if (snapshot.closedBySub[relaySubId])
        closedBySub[entryKey(entry)] = snapshot.closedBySub[relaySubId];
    }
    return { ...snapshot, eoseBySub, closedBySub };
  });
}

function entryKey(entry: Entry): string {
  return entry.key;
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

export const sharedSubscriptionManager = new RelaySubscriptionManager();

function readDedupeKey(
  request: RelayReadRequest,
  options: ReadPageOptions,
): string {
  return JSON.stringify({
    request: subscriptionKey(request),
    timeoutMs: options.timeoutMs ?? 5000,
  });
}

// prettier-ignore
function relaySafeReadRequest(request: RelayReadRequest): RelayReadRequest { return { ...request, filters: relaySafeFilters(request.filters) }; }
