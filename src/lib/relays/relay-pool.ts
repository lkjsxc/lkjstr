import {
  type NostrEvent,
  type NostrFilter,
  type RelayMessage,
} from '../protocol';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import { createRelayClient, type RelayClient } from './relay-client';
import { recordRelayDiagnosticSummary } from './relay-diagnostic-summary';
import { recordRelayHealthEvidence } from './relay-health';
import {
  compatibleRelayList,
  type RelayRequestPurpose,
} from './relay-request-compat';
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

type PublishWaiter = {
  readonly resolve: (result: PublishResult) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export type RelayPool = ReturnType<typeof createRelayPool>;

export function createRelayPool(connectTimeoutMs = 5000) {
  const clients = new Map<string, RelayClient>();
  const snapshotHistory = relaySnapshotHistoryMap();
  const healthStates = new Map<
    string,
    { readonly state: RelayConnectionState; readonly lastError?: string }
  >();
  const events = new Set<(event: PoolEvent) => void>();
  const states = new Set<(states: RelaySnapshot[]) => void>();
  const publishWaiters = new Map<string, Map<string, PublishWaiter>>();

  const snapshots = (): RelaySnapshot[] => {
    for (const relayClient of clients.values()) {
      const snapshot = relayClient.snapshot();
      snapshotHistory.set(snapshot.url, snapshot);
    }
    return [...snapshotHistory.values()];
  };
  const recordHealth = (items: readonly RelaySnapshot[]): void => {
    for (const snapshot of items) {
      const previous = healthStates.get(snapshot.url);
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
      if (errored)
        void recordRelayHealthEvidence(snapshot.url, {
          failure: snapshot.state === 'error' ? snapshot.lastError : undefined,
          lastError: snapshot.lastError,
        });
      void recordRelayDiagnosticSummary(snapshot, {
        attempted,
        opened,
        errored,
      });
      healthStates.set(snapshot.url, {
        state: snapshot.state,
        lastError: snapshot.lastError,
      });
    }
  };
  const emitStates = (): void => {
    const items = snapshots();
    recordHealth(items);
    states.forEach((handler) => handler(items));
  };
  const resolvePublish = (
    eventId: string,
    relay: string,
    result: PublishResult,
  ): void => {
    const waiters = publishWaiters.get(eventId);
    const waiter = waiters?.get(relay);
    if (!waiters || !waiter) return;
    waiters.delete(relay);
    clearTimeout(waiter.timer);
    if (waiters.size === 0) publishWaiters.delete(eventId);
    waiter.resolve(result);
  };
  const handleMessage = (relay: string, message: RelayMessage): void => {
    if (message[0] !== 'OK') return;
    resolvePublish(message[1], relay, {
      relay,
      accepted: message[2],
      message: message[3],
    });
  };
  const client = (url: string): RelayClient => {
    const existing = clients.get(url);
    if (existing) return existing;
    const created = createRelayClient(
      url,
      {
        event: (relay, subId, event) =>
          events.forEach((handler) => handler({ relay, subId, event })),
        message: (relay, message) => handleMessage(relay, message),
        state: () => emitStates(),
      },
      connectTimeoutMs,
    );
    clients.set(url, created);
    return created;
  };
  const publishOne = (
    url: string,
    event: NostrEvent,
    timeoutMs: number,
  ): Promise<PublishResult> =>
    new Promise((resolve) => {
      const waiters = publishWaiters.get(event.id) ?? new Map();
      const timer = setTimeout(() => {
        resolvePublish(event.id, url, {
          relay: url,
          accepted: false,
          message: 'timeout',
        });
      }, timeoutMs);
      waiters.set(url, { resolve, timer });
      publishWaiters.set(event.id, waiters);
      client(url).publish(event);
    });

  return {
    subscribe: (
      relays: readonly string[],
      subId: string,
      filters: readonly NostrFilter[],
      purpose?: RelayRequestPurpose,
    ): (() => void) => {
      const safeFilters = relaySafeFilters(filters);
      const urls = compatibleRelayList(relays, safeFilters, purpose);
      for (const url of urls) client(url).subscribe(subId, safeFilters);
      return () => urls.forEach((url) => client(url).closeSubscription(subId));
    },
    publish: (
      relays: readonly string[],
      event: NostrEvent,
      timeoutMs = 5000,
    ): Promise<PublishResult[]> => {
      const urls = normalizedRelayList(relays);
      return Promise.all(urls.map((url) => publishOne(url, event, timeoutMs)));
    },
    onEvent: (handler: (event: PoolEvent) => void): (() => void) => {
      events.add(handler);
      return () => events.delete(handler);
    },
    onState: (handler: (states: RelaySnapshot[]) => void): (() => void) => {
      states.add(handler);
      handler(snapshots());
      return () => states.delete(handler);
    },
    snapshots,
    close: (): void => {
      for (const waiters of publishWaiters.values()) {
        for (const waiter of waiters.values()) clearTimeout(waiter.timer);
      }
      publishWaiters.clear();
      for (const relayClient of clients.values()) relayClient.close();
      clients.clear();
      emitStates();
    },
  };
}

export const sharedRelayPool = createRelayPool();
