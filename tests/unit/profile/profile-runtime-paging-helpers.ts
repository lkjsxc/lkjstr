import type { NostrEvent } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import {
  orchestratorFromManager,
  stubOrchestrator,
} from '../relays/orchestration/orchestrator-mock';

export type ReadRequest = {
  readonly relays: readonly string[];
  readonly kinds: readonly number[];
  readonly since?: number;
  readonly until?: number;
};

export function initialSubscriptions(
  pubkey: string,
  posts: readonly NostrEvent[],
  reads: ReadRequest[] = [],
) {
  return orchestratorFromManager({
    subscribeLive: () => () => undefined,
    subscribeState: () => () => undefined,
    close: () => undefined,
    counts: () => ({
      liveSubscriptions: 0,
      liveListeners: 0,
      inFlightReads: 0,
    }),
    readPageDetailed: async (request: {
      readonly relays: readonly string[];
      readonly filters: readonly {
        kinds?: number[];
        since?: number;
        until?: number;
      }[];
    }) => {
      const kinds = request.filters.flatMap((filter) => filter.kinds ?? []);
      reads.push({
        relays: [...request.relays],
        kinds,
        since: request.filters[0]?.since,
        until: request.filters[0]?.until,
      });

      const events: PoolEvent[] = kinds.includes(0)
        ? [receipt(event('meta', 200, pubkey, 0), 'wss://relay-a/')]
        : kinds.includes(3)
          ? [receipt(event('follow', 190, pubkey, 3), 'wss://relay-a/')]
          : posts.flatMap((post, index) =>
              index === 0
                ? [
                    receipt(post, 'wss://relay-b/'),
                    receipt(post, 'wss://relay-a/'),
                  ]
                : [receipt(post, 'wss://relay-a/')],
            );

      return {
        events,
        statuses: request.relays.map((relay) => ({
          relay,
          eose: true,
          timeout: false,
          closed: false,
          auth: false,
          socketClosed: false,
          socketError: false,
          durationMs: 1,
          candidateCount: events.filter((e) => e.relay === relay).length,
          finalCount: events.filter((e) => e.relay === relay).length,
        })),
      };
    },
    readPage: async (request: {
      relays: readonly string[];
      filters: readonly {
        kinds?: number[];
        since?: number;
        until?: number;
      }[];
    }) => {
      const kinds = request.filters.flatMap((filter) => filter.kinds ?? []);
      reads.push({
        relays: [...request.relays],
        kinds,
        since: request.filters[0]?.since,
        until: request.filters[0]?.until,
      });
      if (kinds.includes(0))
        return [receipt(event('meta', 200, pubkey, 0), 'wss://relay-a/')];
      if (kinds.includes(3))
        return [receipt(event('follow', 190, pubkey, 3), 'wss://relay-a/')];
      return posts.flatMap((post, index) =>
        index === 0
          ? [receipt(post, 'wss://relay-b/'), receipt(post, 'wss://relay-a/')]
          : [receipt(post, 'wss://relay-a/')],
      );
    },
  } as RelaySubscriptionManager);
}

export function emptySubscriptions() {
  return stubOrchestrator();
}

function receipt(event: NostrEvent, relay: string): PoolEvent {
  return { event, relay, subId: 'sub' };
}

export function event(
  seed: string,
  created_at: number,
  pubkey: string,
  kind: number,
): NostrEvent {
  const id = [...seed]
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64);
  return {
    id,
    pubkey,
    created_at,
    kind,
    tags: [],
    content: '{}',
    sig: 'c'.repeat(128),
  };
}
