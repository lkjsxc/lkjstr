import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import { saveRelayInformation } from '../../../src/lib/relays/relay-info';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://hardening.example/';
const day = 24 * 60 * 60;

describe('relay page scan hardening', () => {
  it('returns newer catch-up events from the newest window first', async () => {
    const now = Math.floor(Date.now() / 1000);
    const older = event('older', now - 44 * day);
    const newer = event('newer', now - 60 * 60);
    const page = await readRelayFeedGroups({
      key: 'newer-first',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'newer',
      after: { createdAt: now - 45 * day, id: 'f'.repeat(64) },
      pageSize: 1,
      subscriptions: detailedSubscriptions([older, newer]),
    });

    expect(page.items.map((item) => item.event.id)).toEqual([newer.id]);
  });

  it('enforces scanner bounds when filter builders omit them', async () => {
    let dispatched: NostrFilter | undefined;
    await readRelayFeedGroups({
      key: 'enforced-bounds',
      groups: [group()],
      filters: () => [{ kinds: [1], limit: 10 }],
      direction: 'older',
      before: { createdAt: 1_000_000, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: {
        readPageDetailed: async (request: RelayReadRequest) => {
          dispatched ??= request.filters[0];
          return detailed([], request, completeStatus);
        },
      } as unknown as RelaySubscriptionManager,
    });

    expect(dispatched).toEqual(
      expect.objectContaining({
        since: expect.any(Number),
        until: 1_000_001,
      }),
    );
  });

  it('treats relay-effective limits below the page size as dense', async () => {
    await saveRelayInformation({
      relayUrl: relay,
      fetchedAt: Date.now(),
      status: 'available',
      info: { limitation: { max_limit: 2 } },
    });
    const events = [event('one', 100), event('two', 99)];
    const page = await readRelayFeedGroups({
      key: 'effective-limit-dense',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 5 }],
      direction: 'older',
      before: { createdAt: 200, id: 'f'.repeat(64) },
      pageSize: 5,
      subscriptions: detailedSubscriptions(events),
    });

    expect(page.items).toHaveLength(2);
    expect(page.hasMorePossible).toBe(true);
  });

  it('does not advance past a dense same-second boundary', async () => {
    const sameSecond = ['1', '2', '3'].map((seed) => event(seed, 100));
    const older = event('old', 90);
    const page = await readRelayFeedGroups({
      key: 'same-second-dense',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 2 }],
      direction: 'older',
      before: { createdAt: 200, id: 'f'.repeat(64) },
      pageSize: 3,
      subscriptions: detailedSubscriptions([...sameSecond, older]),
    });

    expect(page.items.map((item) => item.event.created_at)).toEqual([100, 100]);
    expect(page.hasMorePossible).toBe(true);
  });

  it('exhausts only after the terminal since zero window completes', async () => {
    const page = await readRelayFeedGroups({
      key: 'terminal-exhaustion',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: 200, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: detailedSubscriptions([]),
    });

    expect(page.items).toEqual([]);
    expect(page.hasMorePossible).toBe(false);
  });
});

function detailedSubscriptions(
  events: readonly NostrEvent[],
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      const matching = events
        .filter((item) => matches(item, filter))
        .slice(0, filter?.limit ?? 10)
        .map((item) => receipt(item));
      return detailed(matching, request, completeStatus);
    },
  } as unknown as RelaySubscriptionManager;
}

const completeStatus = { eose: true };

function detailed(
  events: readonly PoolEvent[],
  request: RelayReadRequest,
  status: { readonly eose?: boolean },
): ReadPageResult {
  return {
    events: [...events],
    statuses: request.relays.map((url) => ({
      relay: url,
      eose: status.eose ?? false,
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
}

function matches(event: NostrEvent, filter: NostrFilter | undefined): boolean {
  return (
    (!filter?.kinds || filter.kinds.includes(event.kind)) &&
    (filter?.since === undefined || event.created_at >= filter.since) &&
    (filter?.until === undefined || event.created_at <= filter.until)
  );
}

function group() {
  return {
    key: 'group',
    relays: [relay],
    authors: ['a'.repeat(64)],
    source: 'fallback' as const,
  };
}

function receipt(event: NostrEvent): PoolEvent {
  return { event, relay, subId: 'sub' };
}

function event(seed: string, created_at: number): NostrEvent {
  return {
    id: seed
      .repeat(64)
      .slice(0, 64)
      .padEnd(64, seed.at(0) ?? '0'),
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}
