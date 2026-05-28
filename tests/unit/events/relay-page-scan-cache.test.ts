import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedCoverageForTests,
  saveFeedCoverage,
} from '../../../src/lib/events/feed-coverage-store';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import { semanticFilterKey } from '../../../src/lib/events/relay-page-scan-diagnostics';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://cache.example/';
const bounds = { since: 9_941, until: 10_001 };

describe('relay page scan cache coverage', () => {
  beforeEach(() => {
    clearFeedCoverageForTests();
    clearEventRepositoryForTests();
  });

  it('skips a covered empty segment and advances to the grown remote window', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-empty', relay, 'complete');

    await pageFor('cache-empty', { calls, pageSize: 2, limit: 10 });

    expect(calls[0]).toEqual(expect.objectContaining({ since: 9_822 }));
    expect(span(calls[0]!)).toBe(120);
  });

  it('returns covered cached rows without waiting for relays', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-hit', relay, 'complete');
    await upsertEvent(event('a', 9_999), [relay]);

    const page = await pageFor('cache-hit', { calls, pageSize: 1, limit: 10 });

    expect(page.items.map((item) => item.event.id)).toEqual(['a'.repeat(64)]);
    expect(calls).toEqual([]);
  });

  it('does not skip relays for dense or missing coverage', async () => {
    const denseCalls: NostrFilter[] = [];
    await cover('cache-dense', relay, 'dense');
    await pageFor('cache-dense', { calls: denseCalls, pageSize: 1, limit: 10 });
    expect(span(denseCalls[0]!)).toBe(60);

    const missingCalls: NostrFilter[] = [];
    await pageFor('cache-missing', {
      calls: missingCalls,
      pageSize: 1,
      limit: 10,
    });
    expect(span(missingCalls[0]!)).toBe(60);
  });

  it('filters cached rows outside the segment display bounds', async () => {
    const calls: NostrFilter[] = [];
    await cover('cache-bounds', relay, 'complete');
    await upsertEvent(event('a', 9_999), [relay]);
    await upsertEvent(event('b', 9_000), [relay]);

    const page = await pageFor('cache-bounds', {
      calls,
      pageSize: 1,
      limit: 10,
    });

    expect(page.items.map((item) => item.event.id)).toEqual(['a'.repeat(64)]);
    expect(calls).toEqual([]);
  });
});

async function cover(
  feedKey: string,
  relayUrl: string,
  status: 'complete' | 'dense',
) {
  await saveFeedCoverage({
    feedKey,
    relayUrl,
    groupKey: 'group',
    filterKey: semanticFilterKey({ kinds: [1], ...bounds, limit: 10 }),
    status,
    ...bounds,
  });
}

function pageFor(
  key: string,
  options: {
    readonly calls: NostrFilter[];
    readonly pageSize: number;
    readonly limit: number;
  },
) {
  return readRelayFeedGroups({
    key,
    groups: [
      {
        key: 'group',
        relays: [relay],
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
    subscriptions: subscriptions(options.calls),
  });
}

function subscriptions(calls: NostrFilter[]): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      if (filter) calls.push(filter);
      return detailed(request);
    },
  } as unknown as RelaySubscriptionManager;
}

function detailed(request: RelayReadRequest): ReadPageResult {
  return {
    events: [],
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

function span(filter: NostrFilter): number {
  return (filter.until ?? 0) - (filter.since ?? 0);
}
