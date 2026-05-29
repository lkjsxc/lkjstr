import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedCoverageForTests,
  saveFeedCoverage,
} from '../../../src/lib/events/feed-coverage-store';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import { semanticFilterKey } from '../../../src/lib/events/relay-page-scan-diagnostics';
import {
  customRequestKey,
  readCustomRequestEvents,
} from '../../../src/lib/custom-request/read';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import type { ReadPageOptions } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://custom.example/';

describe('custom request reads', () => {
  beforeEach(() => {
    clearEventRepositoryForTests();
    clearFeedCoverageForTests();
  });

  it('keeps id requests on the exact read path', async () => {
    let exactReads = 0;
    await readCustomRequestEvents({
      request: { relays: [relay], filters: [{ ids: ['a'.repeat(64)] }] },
      relays: [relay],
      owner: 'tab',
      pageSize: 30,
      subscriptions: {
        readPage: async () => {
          exactReads += 1;
          return [];
        },
      } as unknown as SubscriptionOrchestrator,
    });

    expect(exactReads).toBe(1);
  });

  it('intersects user bounds with adaptive segment bounds', async () => {
    const calls: RelayReadRequest[] = [];
    await readCustomRequestEvents({
      request: {
        relays: [relay],
        filters: [{ kinds: [1], since: 10, until: 20, limit: 30 }],
      },
      relays: [relay],
      owner: 'tab',
      pageSize: 30,
      subscriptions: detailedReads(calls, []),
    });

    expect(calls[0]?.filters[0]).toEqual(
      expect.objectContaining({ since: 10, until: 20 }),
    );
  });

  it('uses complete coverage and filters cached rows by user bounds', async () => {
    const request = {
      relays: [relay],
      filters: [{ kinds: [1], since: 10, until: 20, limit: 30 }],
    };
    await saveFeedCoverage({
      feedKey: customRequestKey(request, [relay], 30, 'adaptive-feed'),
      relayUrl: relay,
      groupKey: 'custom-request:selected',
      filterKey: semanticFilterKey(request.filters[0]!),
      status: 'complete',
      since: 10,
      until: 20,
    });
    await upsertEvent(event('a', 15), [relay]);
    await upsertEvent(event('b', 30), [relay]);
    const calls: RelayReadRequest[] = [];

    const events = await readCustomRequestEvents({
      request,
      relays: [relay],
      owner: 'tab',
      pageSize: 30,
      subscriptions: detailedReads(calls, []),
    });

    expect(calls).toEqual([]);
    expect(events.map((item) => item.event.id)).toEqual(['a'.repeat(64)]);
  });

  it('forwards adaptive progressive snapshots through user filters', async () => {
    const snapshots: string[] = [];
    await readCustomRequestEvents({
      request: { relays: [relay], filters: [{ kinds: [1], since: 10 }] },
      relays: [relay],
      owner: 'tab',
      pageSize: 30,
      subscriptions: detailedReads([], [event('a', 15), event('b', 5)]),
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot.items.map((item) => item.event.id).join(','));
      },
    });

    expect(snapshots).toContain('a'.repeat(64));
  });
});

function detailedReads(
  calls: RelayReadRequest[],
  events: readonly NostrEvent[],
): SubscriptionOrchestrator {
  return {
    readPageDetailed: async (
      request: RelayReadRequest,
      options?: ReadPageOptions,
    ) => {
      calls.push(request);
      options?.onSnapshot?.({
        readId: request.key,
        status: 'partial',
        reason: 'relay-events',
        events: events.map((event) => ({ event, relay, subId: 'sub' })),
        relays: [],
        startedAt: 1,
        updatedAt: 1,
        durationMs: 1,
        final: false,
      });
      return {
        events: events.map((event) => ({ event, relay, subId: 'sub' })),
        statuses: request.relays.map((url) => ({
          relay: url,
          eose: true,
          timeout: false,
          closed: false,
          auth: false,
          socketClosed: false,
          socketError: false,
          durationMs: 1,
          candidateCount: events.length,
          finalCount: events.length,
        })),
      };
    },
  } as unknown as SubscriptionOrchestrator;
}

function event(seed: string, created_at: number): NostrEvent {
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
