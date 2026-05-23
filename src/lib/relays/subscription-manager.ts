import { sharedRelayPool, type PoolEvent, type RelayPool } from './relay-pool';
import type { RelaySnapshot } from './types';
import type { RelayReadRequest } from '../events/types';
import { appendAppLog, boundedMessage } from '../log/app-log';
import { readStatuses, type ReadPageResult } from './read-page-status';
import {
  compactRelaySubscriptionId,
  relaySubscriptionIdValid,
} from './subscription-id';

type Listener = (event: PoolEvent) => void;
type Entry = {
  readonly subId: string;
  readonly listeners: Set<Listener>;
  readonly cleanup: () => void;
};

export type ReadPageOptions = {
  readonly timeoutMs?: number;
};

export class RelaySubscriptionManager {
  #entries = new Map<string, Entry>();
  #pool: RelayPool;
  #readSeq = 0;
  #activeReadBaseIds = new Set<string>();
  #usedReadRequestKeys = new Set<string>();

  constructor(pool: RelayPool = sharedRelayPool) {
    this.#pool = pool;
  }

  subscribeLive(request: RelayReadRequest, listener: Listener): () => void {
    const key = subscriptionKey(request);
    const existing = this.#entries.get(key);
    if (existing) {
      existing.listeners.add(listener);
      return () => this.#remove(key, listener);
    }
    const listeners = new Set<Listener>([listener]);
    const subId = relayFacingSubId(request.key);
    const offEvent = this.#pool.onEvent((event) => {
      if (event.subId === subId)
        listeners.forEach((item) => safeNotify(item, event, subId));
    });
    const close = this.#pool.subscribe(request.relays, subId, request.filters);
    this.#entries.set(key, {
      subId,
      listeners,
      cleanup: () => {
        offEvent();
        close();
      },
    });
    return () => this.#remove(key, listener);
  }

  subscribeState(listener: (snapshots: RelaySnapshot[]) => void): () => void {
    return this.#pool.onState(listener);
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
    const events: PoolEvent[] = [];
    let timedOut = false;
    let lastSnapshots: RelaySnapshot[] = [];
    const startedAt = Date.now();
    const requestKey = subscriptionKey(request);
    const baseSubId = relayFacingSubId(request.key);
    const subId =
      this.#activeReadBaseIds.has(baseSubId) ||
      this.#usedReadRequestKeys.has(requestKey)
        ? relayFacingSubId(`${requestKey}:${++this.#readSeq}`)
        : baseSubId;
    this.#activeReadBaseIds.add(baseSubId);
    const offEvent = this.#pool.onEvent((event) => {
      if (event.subId === subId) events.push(event);
    });
    let offState: () => void = () => undefined;
    let close: () => void = () => undefined;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = (timeout = false) => {
        if (done) return;
        done = true;
        timedOut = timeout;
        clearTimeout(timer);
        offState();
        resolve();
      };
      offState = this.#pool.onState((snapshots) => {
        lastSnapshots = snapshots;
        if (pageComplete(snapshots, request.relays, subId)) finish();
      });
      const timer = setTimeout(() => finish(true), options.timeoutMs ?? 5000);
      close = this.#pool.subscribe(request.relays, subId, request.filters);
    });
    offEvent();
    close();
    this.#activeReadBaseIds.delete(baseSubId);
    this.#usedReadRequestKeys.add(requestKey);
    return {
      events,
      statuses: readStatuses({
        relays: request.relays,
        subId,
        events,
        snapshots: lastSnapshots,
        timedOut,
        durationMs: Date.now() - startedAt,
      }),
    };
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

function pageComplete(
  snapshots: readonly RelaySnapshot[],
  relays: readonly string[],
  subId: string,
): boolean {
  const active = snapshots.filter((item) => relays.includes(item.url));
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

export function subscriptionKey(request: RelayReadRequest): string {
  return JSON.stringify({
    key: request.key,
    relays: [...request.relays].sort(),
    filters: request.filters,
  });
}

export function relayFacingSubId(key: string): string {
  return relaySubscriptionIdValid(key)
    ? key
    : compactRelaySubscriptionId('read', 'sub', key);
}

export const sharedSubscriptionManager = new RelaySubscriptionManager();
