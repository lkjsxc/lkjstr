import {
  clearFeedCoverageForTests,
  saveFeedCoverage,
} from '../../../src/lib/events/feed-coverage-store';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import { semanticFilterKey } from '../../../src/lib/events/relay-page-scan-diagnostics';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

export const relay = 'wss://cache.example/';
export const otherRelay = 'wss://cache-other.example/';
export const bounds = { since: 9_941, until: 10_001 };

export function resetCacheScanTests(): void {
  clearFeedCoverageForTests();
  clearEventRepositoryForTests();
}

export async function cover(
  feedKey: string,
  relayUrl: string,
  status: 'complete' | 'dense',
  interval: Partial<typeof bounds> = {},
  options: {
    readonly groupKey?: string;
    readonly kinds?: readonly number[];
  } = {},
) {
  await saveFeedCoverage({
    feedKey,
    relayUrl,
    groupKey: options.groupKey ?? 'group',
    filterKey: semanticFilterKey({
      kinds: options.kinds ?? [1],
      ...bounds,
      limit: 10,
    }),
    status,
    ...bounds,
    ...interval,
  });
}

export function pageFor(
  key: string,
  options: {
    readonly calls: NostrFilter[];
    readonly pageSize: number;
    readonly limit: number;
    readonly relays?: readonly string[];
    readonly subscriptions?: RelaySubscriptionManager;
  },
) {
  return readRelayFeedGroups({
    key,
    groups: [
      {
        key: 'group',
        relays: options.relays ?? [relay],
        authors: [],
        source: 'fallback' as const,
      },
    ],
    filters: (_group, segment) => [
      { kinds: [1], ...segment, limit: options.limit },
    ],
    direction: 'older',
    before: { createdAt: 10_000, id: 'f'.repeat(64) },
    pageSize: options.pageSize,
    subscriptions: options.subscriptions ?? subscriptions(options.calls),
  });
}

export function subscriptions(
  calls: NostrFilter[],
  requests: RelayReadRequest[] = [],
  events: readonly PoolEvent[] = [],
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      if (filter) calls.push(filter);
      requests.push(request);
      return detailed(request, events);
    },
  } as unknown as RelaySubscriptionManager;
}

export function throwingSubscriptions(): RelaySubscriptionManager {
  return {
    readPage: async () => {
      throw new Error('relay manager should not be called');
    },
    readPageDetailed: async () => {
      throw new Error('relay manager should not be called');
    },
  } as unknown as RelaySubscriptionManager;
}

export function poolEvent(seed: string, relayUrl: string): PoolEvent {
  return { relay: relayUrl, subId: 'test', event: event(seed, 9_998) };
}

export function event(seed: string, created_at: number): NostrEvent {
  return {
    id: seed.repeat(64),
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}

export function span(filter: NostrFilter): number {
  return (filter.until ?? 0) - (filter.since ?? 0);
}

function detailed(
  request: RelayReadRequest,
  events: readonly PoolEvent[] = [],
): ReadPageResult {
  return {
    events: [...events],
    statuses: request.relays.map((url) => ({
      relay: url,
      eose: true,
      timeout: false,
      closed: false,
      auth: false,
      socketClosed: false,
      socketError: false,
      durationMs: 1,
      candidateCount: 0,
      finalCount: 0,
    })),
  };
}
