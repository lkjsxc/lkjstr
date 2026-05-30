import { describe, expect, it } from 'vitest';
import {
  clearFeedCoverageForTests,
  coverageForFeed,
} from '../../../src/lib/events/feed-coverage-store';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import {
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';
import type { NostrEvent } from '../../../src/lib/protocol';
import { saveRelayInformation } from '../../../src/lib/relays/relay-info';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://relay.example/';

describe('relay page scan cursors', () => {
  it('returns unresolved dense shard cursor before sparse older ranges', async () => {
    await saveRelayInformation({
      relayUrl: relay,
      fetchedAt: Date.now(),
      status: 'available',
      info: { limitation: { maxLimit: 2 } },
    });
    const dense = [event('a', 100), event('b', 100), event('c', 100)];
    const sparse = event('old', 90);
    const page = await readRelayFeedGroups({
      key: 'scan-safe-cursor',
      groups: [group('dense'), group('sparse')],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 2 }],
      direction: 'older',
      before: { createdAt: 200, id: 'f'.repeat(64) },
      pageSize: 3,
      subscriptions: {
        readPageDetailed: async (request: RelayReadRequest) =>
          detailed(
            (request.key.includes(':0:0:') ? dense : [sparse]).map((item) =>
              receipt(item, request.relays[0] ?? relay),
            ),
            request,
            true,
          ),
      } as unknown as RelaySubscriptionManager,
    });

    expect(page.items.map((item) => item.event.created_at)).toEqual([
      100, 100, 100,
    ]);
    expect(page.nextCursor?.createdAt).toBe(100);
  });

  it('records incomplete coverage and logs relay scan warnings', async () => {
    clearFeedCoverageForTests();
    clearAppLogForTests();
    await readRelayFeedGroups({
      key: 'scan-coverage',
      groups: [group()],
      filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
      direction: 'older',
      before: { createdAt: 2_000_000, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: {
        readPageDetailed: async (request: RelayReadRequest) =>
          detailed([], request, false),
      } as unknown as RelaySubscriptionManager,
    });

    expect(await coverageForFeed('scan-coverage')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'unresolved',
          reason: 'incomplete-minimum',
          eventCount: 0,
          limit: expect.any(Number),
        }),
      ]),
    );
    expect(appLogRecords()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'relay-feed-incomplete',
          context: expect.objectContaining({ feedKey: 'scan-coverage' }),
        }),
      ]),
    );
  });
});

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
