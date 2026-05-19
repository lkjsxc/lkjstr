import type { NostrEvent } from '../protocol';
import { sharedRelayPool, type PoolEvent, type RelayPool } from './relay-pool';
import type { RelaySnapshot } from './types';
import type { RelayReadRequest } from '../events/types';

type Listener = (event: PoolEvent) => void;
type Entry = {
  readonly subId: string;
  readonly listeners: Set<Listener>;
  readonly cleanup: () => void;
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
      if (event.subId === subId) listeners.forEach((item) => item(event));
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
    timeoutMs = 5000,
  ): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];
    const cleanup = this.subscribeLive(request, (event) =>
      events.push(event.event),
    );
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    cleanup();
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

export function subscriptionKey(request: RelayReadRequest): string {
  return JSON.stringify({
    relays: [...request.relays].sort(),
    filters: request.filters,
  });
}

export const sharedSubscriptionManager = new RelaySubscriptionManager();
