import { describe, expect, it } from 'vitest';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type {
  ReadPageOptions,
  RelaySubscriptionManager,
} from '../../../src/lib/relays/subscription-manager';

describe('relay page scan duplicate receipts', () => {
  it('retains enough raw receipts to fill unique pages across relays', async () => {
    const now = Math.floor(Date.now() / 1000);
    const events = Array.from({ length: 45 }, (_, index) =>
      event(String(index + 1), now - index),
    );
    const relays = Array.from(
      { length: 7 },
      (_, index) => `wss://relay-${index}.example/`,
    );

    const page = await readRelayFeedGroups({
      key: 'scan-duplicates',
      groups: [
        {
          key: 'duplicates',
          relays,
          authors: ['a'.repeat(64)],
          source: 'fallback',
        },
      ],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 30 }],
      direction: 'initial',
      pageSize: 30,
      subscriptions: duplicateSubscriptions(events),
    });

    expect(page.items).toHaveLength(30);
    expect(page.items[0]?.event.content).toBe(events[0]?.content);
    expect(new Set(page.items.map((item) => item.event.id)).size).toBe(30);
  });
});

function duplicateSubscriptions(
  events: readonly NostrEvent[],
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (
      request: RelayReadRequest,
      options: ReadPageOptions = {},
    ) => {
      const filter = request.filters[0];
      const matching = events.filter((item) => matches(item, filter));
      const limit = options.maxEvents ?? 1000;
      const out: PoolEvent[] = [];
      for (const url of request.relays) {
        for (const item of matching) {
          out.push({ event: item, relay: url, subId: request.key });
          if (out.length >= limit) return detailed(out, request, false);
        }
      }
      return detailed(out, request, true);
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
      candidateCount: events.filter((item) => item.relay === url).length,
      finalCount: events.filter((item) => item.relay === url).length,
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
