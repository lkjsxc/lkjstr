import { sharedRelayPool, type PoolEvent, type RelayPool } from './relay-pool';
import type { RelaySnapshot } from './types';
import type { RelayReadRequest } from '../events/types';
import { appendAppLog, boundedMessage } from '../log/app-log';

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
    const subId = request.key;
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
    const events: PoolEvent[] = [];
    const subId = request.key;
    const offEvent = this.#pool.onEvent((event) => {
      if (event.subId === subId) events.push(event);
    });
    const close = this.#pool.subscribe(request.relays, subId, request.filters);
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        offState();
        resolve();
      };
      const offState = this.#pool.onState((snapshots) => {
        if (pageComplete(snapshots, request.relays, subId)) finish();
      });
      const timer = setTimeout(finish, options.timeoutMs ?? 5000);
    });
    offEvent();
    close();
    return events;
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

export const sharedSubscriptionManager = new RelaySubscriptionManager();
