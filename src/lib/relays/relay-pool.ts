import {
  normalizeRelayUrl,
  type NostrEvent,
  type NostrFilter,
  type RelayMessage,
} from '../protocol';
import { RelayClient } from './relay-client';
import type { RelaySnapshot } from './types';

export type PoolEvent = {
  readonly relay: string;
  readonly subId: string;
  readonly event: NostrEvent;
};

export type PublishResult = {
  readonly relay: string;
  readonly accepted?: boolean;
  readonly message?: string;
};

export class RelayPool {
  #clients = new Map<string, RelayClient>();
  #events = new Set<(event: PoolEvent) => void>();
  #states = new Set<(states: RelaySnapshot[]) => void>();
  #publishWaiters = new Map<
    string,
    Map<string, (result: PublishResult) => void>
  >();

  subscribe(
    relays: readonly string[],
    subId: string,
    filters: readonly NostrFilter[],
  ): () => void {
    const urls = relays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url));
    for (const url of urls) this.#client(url).subscribe(subId, filters);
    return () =>
      urls.forEach((url) => this.#client(url).closeSubscription(subId));
  }

  publish(
    relays: readonly string[],
    event: NostrEvent,
    timeoutMs = 5000,
  ): Promise<PublishResult[]> {
    const urls = relays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url));
    const promises = urls.map((url) => this.#publishOne(url, event, timeoutMs));
    return Promise.all(promises);
  }

  onEvent(handler: (event: PoolEvent) => void): () => void {
    this.#events.add(handler);
    return () => this.#events.delete(handler);
  }

  onState(handler: (states: RelaySnapshot[]) => void): () => void {
    this.#states.add(handler);
    handler(this.snapshots());
    return () => this.#states.delete(handler);
  }

  snapshots(): RelaySnapshot[] {
    return [...this.#clients.values()].map((client) => client.snapshot());
  }

  close(): void {
    for (const client of this.#clients.values()) client.close();
    this.#clients.clear();
    this.#emitStates();
  }

  #client(url: string): RelayClient {
    const existing = this.#clients.get(url);
    if (existing) return existing;
    const client = new RelayClient(url, {
      event: (relay, subId, event) =>
        this.#events.forEach((handler) => handler({ relay, subId, event })),
      message: (relay, message) => this.#handleMessage(relay, message),
      state: () => this.#emitStates(),
    });
    this.#clients.set(url, client);
    return client;
  }

  #publishOne(
    url: string,
    event: NostrEvent,
    timeoutMs: number,
  ): Promise<PublishResult> {
    return new Promise((resolve) => {
      const waiters =
        this.#publishWaiters.get(event.id) ??
        new Map<string, (result: PublishResult) => void>();
      waiters.set(url, resolve);
      this.#publishWaiters.set(event.id, waiters);
      this.#client(url).publish(event);
      setTimeout(() => {
        if (!waiters.has(url)) return;
        waiters.delete(url);
        resolve({ relay: url, accepted: false, message: 'timeout' });
      }, timeoutMs);
    });
  }

  #handleMessage(relay: string, message: RelayMessage): void {
    if (message[0] !== 'OK') return;
    const waiters = this.#publishWaiters.get(message[1]);
    const resolve = waiters?.get(relay);
    if (!resolve) return;
    waiters?.delete(relay);
    resolve({ relay, accepted: message[2], message: message[3] });
  }

  #emitStates(): void {
    const states = this.snapshots();
    this.#states.forEach((handler) => handler(states));
  }
}
