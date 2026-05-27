import { describe, expect, it } from 'vitest';
import {
  boundarySince,
  boundaryUntil,
  readRelayFeedPage,
  readRelayFeedGroups,
} from '../../../src/lib/events/relay-page';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import { orchestratorFromManager } from '../relays/orchestration/orchestrator-mock';

describe('relay feed pages', () => {
  it('sorts by compound event cursor before slicing', async () => {
    const page = await readRelayFeedPage({
      key: 'relay-page-sort',
      relays: ['wss://relay.example/'],
      filters: [{ kinds: [1] }],
      pageSize: 2,
      subscriptions: subscriptions([
        receipt(event('3', 9), 'wss://relay.example/'),
        receipt(event('2', 10), 'wss://relay.example/'),
        receipt(event('1', 10), 'wss://relay.example/'),
      ]),
    });

    expect(page.map((item) => item.event.id)).toEqual([
      '1'.repeat(64),
      '2'.repeat(64),
    ]);
  });

  it('merges duplicate relay provenance', async () => {
    const page = await readRelayFeedPage({
      key: 'relay-page-dupes',
      relays: ['wss://relay-a/', 'wss://relay-b/'],
      filters: [{ kinds: [1] }],
      pageSize: 10,
      subscriptions: subscriptions([
        receipt(event('1', 10), 'wss://relay-a/'),
        receipt(event('1', 10), 'wss://relay-b/'),
      ]),
    });

    expect(page).toHaveLength(1);
    expect(page[0]?.relays).toEqual(['wss://relay-a/', 'wss://relay-b/']);
  });

  it('filters before and after cursors on same-second boundaries', async () => {
    const events = ['1', '2', '3'].map((id) =>
      receipt(event(id, 10), 'wss://relay.example/'),
    );
    const request = {
      key: 'relay-page-cursors',
      relays: ['wss://relay.example/'],
      filters: [{ kinds: [1] }],
      pageSize: 10,
      subscriptions: subscriptions(events),
    };

    const before = await readRelayFeedPage({
      ...request,
      before: { createdAt: 10, id: '2'.repeat(64) },
    });
    const after = await readRelayFeedPage({
      ...request,
      after: { createdAt: 10, id: '2'.repeat(64) },
    });

    expect(before.map((item) => item.event.id)).toEqual(['3'.repeat(64)]);
    expect(after.map((item) => item.event.id)).toEqual(['1'.repeat(64)]);
  });

  it('widens relay boundaries so local filters keep same-second candidates', () => {
    expect(boundaryUntil({ createdAt: 10, id: 'a'.repeat(64) })).toBe(11);
    expect(boundarySince({ createdAt: 10, id: 'a'.repeat(64) })).toBe(9);
    expect(boundarySince({ createdAt: 0, id: 'a'.repeat(64) })).toBe(0);
  });

  it('keeps relay limits positive', async () => {
    let limit = 0;
    await readRelayFeedPage({
      key: 'relay-page-positive-limit',
      relays: ['wss://relay.example/'],
      filters: [{ kinds: [1], limit: 0 }],
      pageSize: 10,
      subscriptions: {
        readPage: async (request: RelayReadRequest) => {
          limit = request.filters[0]?.limit ?? 0;
          return [];
        },
        readPageDetailed: async (request: RelayReadRequest) => {
          limit = request.filters[0]?.limit ?? 0;
          return { events: [], statuses: [] };
        },
      },
    });
    expect(limit).toBe(1);
  });

  it('does not display relay rows outside current-time policy', async () => {
    const now = Math.floor(Date.now() / 1000);
    const page = await readRelayFeedPage({
      key: 'relay-page-future',
      relays: ['wss://relay.example/'],
      filters: [{ kinds: [1] }],
      pageSize: 10,
      subscriptions: subscriptions([
        receipt(event('future', now + 60), 'wss://relay.example/'),
        receipt(event('current', now), 'wss://relay.example/'),
      ]),
    });

    expect(page.map((item) => item.event.content)).toEqual(['current']);
  });

  it('adds interval bounds to historical relay groups', async () => {
    let since: number | undefined;
    let until: number | undefined;
    await readRelayFeedGroups({
      key: 'relay-page-groups',
      groups: [
        {
          key: 'group',
          relays: ['wss://relay.example/'],
          authors: ['a'.repeat(64)],
          source: 'fallback',
        },
      ],
      filters: (_group, bounds) => {
        since = bounds.since;
        until = bounds.until;
        return [{ kinds: [1], ...bounds, limit: 10 }];
      },
      direction: 'older',
      before: { createdAt: 1000, id: 'b'.repeat(64) },
      pageSize: 10,
      subscriptions: subscriptions([]),
    });
    expect(since).toBeDefined();
    expect(until).toBe(1001);
  });
});

function subscriptions(events: readonly PoolEvent[]) {
  return orchestratorFromManager({
    subscribeLive: () => () => undefined,
    subscribeState: () => () => undefined,
    close: () => undefined,
    counts: () => ({
      liveSubscriptions: 0,
      liveListeners: 0,
      inFlightReads: 0,
    }),
    readPageDetailed: async () => ({ events: [...events], statuses: [] }),
    readPage: async () => [...events],
  } as import('../../../src/lib/relays/subscription-manager').RelaySubscriptionManager);
}

function receipt(event: NostrEvent, relay: string): PoolEvent {
  return { event, relay, subId: 'sub' };
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
