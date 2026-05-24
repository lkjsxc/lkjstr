import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import { relayReadEventCap } from '../../../src/lib/events/relay-page-limits';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://relay.example/';
const day = 24 * 60 * 60;

describe('relay page scan', () => {
  it('computes a relay read cap from effective limits and relay count', () => {
    expect(
      relayReadEventCap(
        [
          { kinds: [1], limit: 2 },
          { kinds: [6], limit: 3 },
        ],
        2,
        10,
      ),
    ).toBe(20);
    expect(relayReadEventCap([{ kinds: [1], limit: 40 }], 4, 10, 100)).toBe(
      100,
    );
  });

  it('finds sparse older history across empty complete windows', async () => {
    const now = Math.floor(Date.now() / 1000);
    const older = event('old', now - 45 * day);
    const page = await readRelayFeedGroups({
      key: 'scan-sparse',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: now, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: detailedSubscriptions([older]),
    });

    expect(page.items.map((item) => item.event.id)).toEqual([older.id]);
  });

  it('keeps incomplete empty windows non-exhaustive', async () => {
    const page = await readRelayFeedGroups({
      key: 'scan-timeout',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: 2_000_000, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: detailedSubscriptions([], false),
    });

    expect(page.items).toEqual([]);
    expect(page.hasMorePossible).toBe(true);
  });

  it('paginates dense windows without duplicates across pages', async () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      event(String(index + 1), 1_000 - index),
    );
    const subscriptions = detailedSubscriptions(events);
    const first = await readRelayFeedGroups({
      key: 'scan-dense-first',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 2 }],
      direction: 'older',
      before: { createdAt: 2_000, id: 'f'.repeat(64) },
      pageSize: 2,
      subscriptions,
    });
    const second = await readRelayFeedGroups({
      key: 'scan-dense-second',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 2 }],
      direction: 'older',
      before: {
        createdAt: first.items.at(-1)!.event.created_at,
        id: first.items.at(-1)!.event.id,
      },
      pageSize: 2,
      subscriptions,
    });

    expect(first.items.map((item) => item.event.id)).toEqual([
      events[0]!.id,
      events[1]!.id,
    ]);
    expect(second.items.map((item) => item.event.id)).toEqual([
      events[2]!.id,
      events[3]!.id,
    ]);
    expect(
      new Set([...first.items, ...second.items].map((item) => item.event.id))
        .size,
    ).toBe(4);
  });

  it('reads groups sequentially with deterministic keys', async () => {
    const calls: string[] = [];
    await readRelayFeedGroups({
      key: 'scan-sequential',
      groups: [group('first'), group('second')],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'initial',
      pageSize: 10,
      subscriptions: {
        readPageDetailed: async (request: RelayReadRequest) => {
          calls.push(request.key);
          return detailed([], request, true);
        },
      } as unknown as RelaySubscriptionManager,
    });

    expect(calls.slice(0, 2)).toEqual([
      'scan-sequential:0:0:0:0',
      'scan-sequential:0:1:0:0',
    ]);
  });
});

function detailedSubscriptions(
  events: readonly NostrEvent[],
  complete = true,
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      const limit = filter?.limit ?? 10;
      const matching = events
        .filter((item) => matches(item, filter))
        .slice(0, limit)
        .map((item) => receipt(item, request.relays[0] ?? relay));
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

function matches(event: NostrEvent, filter: NostrFilter | undefined): boolean {
  return (
    (!filter?.kinds || filter.kinds.includes(event.kind)) &&
    (filter?.since === undefined || event.created_at >= filter.since) &&
    (filter?.until === undefined || event.created_at <= filter.until)
  );
}

function group(key = 'group') {
  return {
    key,
    relays: [relay],
    authors: ['a'.repeat(64)],
    source: 'fallback' as const,
  };
}

function receipt(event: NostrEvent, relayUrl: string): PoolEvent {
  return { event, relay: relayUrl, subId: 'sub' };
}

function event(seed: string, created_at: number): NostrEvent {
  const id = seed
    .repeat(64)
    .slice(0, 64)
    .padEnd(64, seed.at(0) ?? '0');
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}
