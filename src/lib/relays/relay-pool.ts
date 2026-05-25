import type { NostrEvent, NostrFilter, RelayMessage } from '../protocol';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import { createRelayClient, type RelayClient } from './relay-client';
import {
  compatibleRelayList,
  type RelayRequestPurpose,
} from './relay-request-compat';
import { createRelayPoolHealthRecorder } from './relay-pool-health';
import { createRelayPoolIdleTracker } from './relay-pool-idle';
// prettier-ignore
import { relaySubscribeOptions, type RelaySubscribeOptions } from './relay-subscription-strategy';
import { normalizedRelayList } from './relay-url-list';
import { relaySnapshotHistoryMap } from './session-snapshots';
import type { RelaySnapshot } from './types';
import { createRelayPublishWaiters } from './relay-publish-waiters';
import { incMemoryCounter, decMemoryCounter } from '../app/memory-counters';

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

export type RelayPool = ReturnType<typeof createRelayPool>;

export function createRelayPool(connectTimeoutMs = 5000, idleGraceMs = 15_000) {
  const clients = new Map<string, RelayClient>();
  const snapshotHistory = relaySnapshotHistoryMap();
  const health = createRelayPoolHealthRecorder();
  const events = new Set<(event: PoolEvent) => void>();
  const states = new Set<(states: RelaySnapshot[]) => void>();
  const publishWaiters = createRelayPublishWaiters();
  const pendingPublishEvents = new Map<string, NostrEvent>();
  const idle = createRelayPoolIdleTracker({
    clients,
    snapshots: snapshotHistory,
    idleGraceMs,
    onChange: () => emitStates(),
  });

  const snapshots = (): RelaySnapshot[] => {
    for (const relayClient of clients.values()) {
      const snapshot = relayClient.snapshot();
      snapshotHistory.set(snapshot.url, snapshot);
    }
    return [...snapshotHistory.values()];
  };
  const emitStates = (): void => {
    const items = snapshots();
    health.record(items, resendPendingPublishes);
    states.forEach((handler) => handler(items));
  };
  const resolvePublish = (
    eventId: string,
    relay: string,
    result: PublishResult,
  ): void => {
    if (!publishWaiters.settle(eventId, relay, result)) return;
    if (!publishWaiters.eventHasWaiters(eventId))
      pendingPublishEvents.delete(eventId);
    idle.end(relay);
  };
  const resendPendingPublishes = (url: string): void => {
    const relayClient = clients.get(url);
    if (!relayClient) return;
    for (const event of publishWaiters.pendingEventsForRelay(url))
      relayClient.publish(event);
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
    incMemoryCounter('active-relay-clients');
    return created;
  };
  const publishOne = (
    url: string,
    event: NostrEvent,
    timeoutMs: number,
  ): Promise<PublishResult> => {
    const waiter = publishWaiters.begin(event, url, timeoutMs, () => {
      resolvePublish(event.id, url, {
        relay: url,
        accepted: false,
        message: 'timeout',
      });
    });
    if (waiter.created) {
      idle.begin(url);
      pendingPublishEvents.set(event.id, event);
      client(url).publish(event);
    }
    return waiter.promise;
  };

  return {
    // prettier-ignore
    subscribe: (relays: readonly string[], subId: string, filters: readonly NostrFilter[], options?: RelayRequestPurpose | RelaySubscribeOptions): (() => void) => {
      const safeFilters = relaySafeFilters(filters), parsedOptions = relaySubscribeOptions(options);
      const urls = compatibleRelayList(relays, safeFilters, parsedOptions.purpose);
      for (const url of urls) {
        idle.begin(url);
        client(url).subscribe(subId, safeFilters, parsedOptions);
      }
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        for (const url of urls) {
          clients.get(url)?.closeSubscription(subId);
          idle.end(url);
        }
      };
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
    __debugClientCount: () => idle.clientCount(),
    close: (): void => {
      publishWaiters.settleAll('closed');
      pendingPublishEvents.clear();
      idle.clear();
      for (const relayClient of clients.values()) {
        snapshotHistory.set(relayClient.snapshot().url, relayClient.snapshot());
        relayClient.close();
        snapshotHistory.set(relayClient.snapshot().url, relayClient.snapshot());
      }
      decMemoryCounter('active-relay-clients', clients.size);
      clients.clear();
      events.clear();
      states.clear();
    },
  };
}

export const sharedRelayPool = createRelayPool();
