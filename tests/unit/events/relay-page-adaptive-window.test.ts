import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import { saveRelayInformation } from '../../../src/lib/relays/relay-info';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://adaptive.example/';

describe('relay page adaptive windows', () => {
  it('continues after sparse non-empty windows until the page fills', async () => {
    const calls: NostrFilter[] = [];
    const events = [event('new', 9_900), event('old', 8_300)];
    const page = await pageFor(events, { calls, pageSize: 2, limit: 10 });
    expect(page.items.map((item) => item.event.id)).toEqual(
      events.map((item) => item.id),
    );
    expect([span(calls[0]!), span(calls[1]!)]).toEqual([720, 1_440]);
  });

  it('doubles empty complete windows', async () => {
    const calls: NostrFilter[] = [];
    await pageFor([], { calls, pageSize: 2, limit: 10 });
    expect(span(calls[0]!)).toBe(720);
    expect(span(calls[1]!)).toBe(1_440);
  });

  it('keeps balanced complete window spans unchanged', async () => {
    const events = [
      event('a', 9_900),
      event('b', 9_800),
      event('c', 9_700),
      event('d', 9_200),
      event('e', 9_100),
    ];
    const calls: NostrFilter[] = [];
    await pageFor(events, { calls, pageSize: 10, limit: 5 });
    expect(span(calls[0]!)).toBe(720);
    expect(span(calls[1]!)).toBe(720);
  });

  it('splits dense windows immediately', async () => {
    const events = [event('a', 9_900), event('b', 9_800)];
    const calls: NostrFilter[] = [];
    await pageFor(events, {
      calls,
      pageSize: 10,
      limit: 2,
    });
    expect(calls[1]).toEqual(expect.objectContaining({ since: 9_641 }));
  });

  it('splits dense full-page windows before returning', async () => {
    const events = [event('a', 9_900), event('b', 9_800), event('c', 9_700)];
    const calls: NostrFilter[] = [];
    const page = await pageFor(events, { calls, pageSize: 2, limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(calls.length).toBeGreaterThan(1);
  });

  it('returns unresolved dense minimum-span windows conservatively', async () => {
    const page = await pageFor([event('a', 9_999), event('b', 9_999)], {
      pageSize: 2,
      limit: 1,
    });
    expect(page.items).toHaveLength(1);
    expect(page.dense).toBe(true);
    expect(page.hasMorePossible).toBe(true);
  });

  it('does not grow incomplete windows', async () => {
    const calls: NostrFilter[] = [];
    const page = await pageFor([], {
      calls,
      pageSize: 2,
      limit: 10,
      complete: false,
    });
    expect(page.incomplete).toBe(true);
    expect(page.hasMorePossible).toBe(true);
    expect(calls.every((call) => (call.since ?? 0) >= 9_281)).toBe(true);
  });

  it('uses relay-effective low limits for density feedback', async () => {
    await saveRelayInformation({
      relayUrl: relay,
      fetchedAt: Date.now(),
      status: 'available',
      info: { limitation: { max_limit: 1 } },
    });
    const calls: NostrFilter[] = [];
    const page = await pageFor([event('a', 9_900), event('b', 9_800)], {
      calls,
      pageSize: 5,
      limit: 10,
    });
    expect(calls[0]?.limit).toBe(1);
    expect(page.dense).toBe(true);
  });
});

function pageFor(
  events: readonly NostrEvent[],
  options: {
    readonly calls?: NostrFilter[];
    readonly pageSize: number;
    readonly limit: number;
    readonly complete?: boolean;
  },
) {
  const calls = options.calls ?? [];
  return readRelayFeedGroups({
    key: `adaptive-${Math.random()}`,
    groups: [group()],
    filters: (_group, bounds) => [
      { kinds: [1], ...bounds, limit: options.limit },
    ],
    direction: 'older',
    before: { createdAt: 10_000, id: 'f'.repeat(64) },
    pageSize: options.pageSize,
    subscriptions: subscriptions(events, calls, options.complete ?? true),
  });
}

function subscriptions(
  events: readonly NostrEvent[],
  calls: NostrFilter[],
  complete: boolean,
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      if (filter) calls.push(filter);
      const matching = events
        .filter((item) => matches(item, filter))
        .slice(0, filter?.limit ?? 10)
        .map((item) => ({ event: item, relay, subId: 'sub' }));
      return detailed(matching, request, complete);
    },
  } as unknown as RelaySubscriptionManager;
}

function detailed(
  events: readonly PoolEvent[],
  request: RelayReadRequest,
  complete: boolean,
): ReadPageResult {
  return {
    events: [...events],
    statuses: request.relays.map((url) => ({
      relay: url,
      eose: complete,
      timeout: !complete,
      closed: false,
      auth: false,
      socketClosed: false,
      socketError: false,
      durationMs: 1,
      candidateCount: events.length,
      finalCount: events.length,
    })),
  };
}

function group() {
  return {
    key: 'group',
    relays: [relay],
    authors: ['a'.repeat(64)],
    source: 'fallback' as const,
  };
}

function matches(event: NostrEvent, filter: NostrFilter | undefined): boolean {
  return (
    (!filter?.kinds || filter.kinds.includes(event.kind)) &&
    (filter?.since === undefined || event.created_at >= filter.since) &&
    (filter?.until === undefined || event.created_at <= filter.until)
  );
}

function event(seed: string, created_at: number): NostrEvent {
  return {
    id: seed.repeat(64).slice(0, 64).padEnd(64, seed),
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}

function span(filter: NostrFilter): number {
  return (filter.until ?? 0) - (filter.since ?? 0);
}
