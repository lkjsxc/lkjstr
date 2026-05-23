import {
  type NostrEvent,
  type NostrFilter,
  type RelayMessage,
} from '../protocol';
import { RelayClient } from './relay-client';
import { recordRelayDiagnosticSummary } from './relay-diagnostic-summary';
import { recordRelayHealthEvidence } from './relay-health';
import { normalizedRelayList } from './relay-url-list';
import { relaySnapshotHistoryMap } from './session-snapshots';
import type { RelayConnectionState, RelaySnapshot } from './types';

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
  #snapshotHistory = relaySnapshotHistoryMap();
  #healthStates = new Map<
    string,
    { readonly state: RelayConnectionState; readonly lastError?: string }
  >();
  #events = new Set<(event: PoolEvent) => void>();
  #states = new Set<(states: RelaySnapshot[]) => void>();
  #publishWaiters = new Map<
    string,
    Map<string, (result: PublishResult) => void>
  >();

  constructor(readonly connectTimeoutMs = 5000) {}

  subscribe(
    relays: readonly string[],
    subId: string,
    filters: readonly NostrFilter[],
  ): () => void {
    const urls = normalizedRelayList(relays);
    for (const url of urls) this.#client(url).subscribe(subId, filters);
    return () =>
      urls.forEach((url) => this.#client(url).closeSubscription(subId));
  }

  publish(
    relays: readonly string[],
    event: NostrEvent,
    timeoutMs = 5000,
  ): Promise<PublishResult[]> {
    const urls = normalizedRelayList(relays);
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
    for (const client of this.#clients.values()) {
      const snapshot = client.snapshot();
      this.#snapshotHistory.set(snapshot.url, snapshot);
    }
    return [...this.#snapshotHistory.values()];
  }

  close(): void {
    for (const client of this.#clients.values()) client.close();
    this.#clients.clear();
    this.#emitStates();
  }

  #client(url: string): RelayClient {
    const existing = this.#clients.get(url);
    if (existing) return existing;
    const client = new RelayClient(
      url,
      {
        event: (relay, subId, event) =>
          this.#events.forEach((handler) => handler({ relay, subId, event })),
        message: (relay, message) => this.#handleMessage(relay, message),
        state: () => this.#emitStates(),
      },
      this.connectTimeoutMs,
    );
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
        this.#resolvePublish(event.id, url, {
          relay: url,
          accepted: false,
          message: 'timeout',
        });
      }, timeoutMs);
    });
  }

  #handleMessage(relay: string, message: RelayMessage): void {
    if (message[0] !== 'OK') return;
    const waiters = this.#publishWaiters.get(message[1]);
    const resolve = waiters?.get(relay);
    if (!resolve) return;
    this.#resolvePublish(message[1], relay, {
      relay,
      accepted: message[2],
      message: message[3],
    });
  }

  #resolvePublish(eventId: string, relay: string, result: PublishResult): void {
    const waiters = this.#publishWaiters.get(eventId);
    const resolve = waiters?.get(relay);
    if (!waiters || !resolve) return;
    waiters.delete(relay);
    if (waiters.size === 0) this.#publishWaiters.delete(eventId);
    resolve(result);
  }

  #emitStates(): void {
    const states = this.snapshots();
    this.#recordHealth(states);
    this.#states.forEach((handler) => handler(states));
  }

  #recordHealth(states: readonly RelaySnapshot[]): void {
    for (const snapshot of states) {
      const previous = this.#healthStates.get(snapshot.url);
      const attempted =
        previous?.state !== 'connecting' && snapshot.state === 'connecting';
      const opened = previous?.state !== 'open' && snapshot.state === 'open';
      const errored = Boolean(
        snapshot.lastError &&
        (previous?.lastError !== snapshot.lastError ||
          (previous?.state !== 'error' && snapshot.state === 'error')),
      );
      if (attempted)
        void recordRelayHealthEvidence(snapshot.url, { attempted: true });
      if (opened)
        void recordRelayHealthEvidence(snapshot.url, {
          connectedAt: Date.now(),
        });
      if (errored) {
        void recordRelayHealthEvidence(snapshot.url, {
          failure: snapshot.state === 'error' ? snapshot.lastError : undefined,
          lastError: snapshot.lastError,
        });
      }
      void recordRelayDiagnosticSummary(snapshot, {
        attempted,
        opened,
        errored,
      });
      this.#healthStates.set(snapshot.url, {
        state: snapshot.state,
        lastError: snapshot.lastError,
      });
    }
  }
}

export const sharedRelayPool = new RelayPool();
