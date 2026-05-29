import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedScanHintsForTests,
  saveFeedScanHint,
} from '../../../src/lib/events/feed-scan-hints';
import { readRelayFeedGroups } from '../../../src/lib/events/relay-page';
import { semanticFilterKey } from '../../../src/lib/events/relay-page-scan-diagnostics';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';

const relay = 'wss://warm-a.example/';
const otherRelay = 'wss://warm-b.example/';
const filterKey = semanticFilterKey({ kinds: [1] });

describe('relay page adaptive warm starts', () => {
  beforeEach(() => clearFeedScanHintsForTests());

  it('uses warmed spans when every required relay has sparse hints', async () => {
    const calls: NostrFilter[] = [];
    await saveHint('warm-all', relay, 120, 'under-half');

    await pageFor('warm-all', {
      calls,
      relays: [relay],
      events: [event('a', 9_950)],
    });

    expect(span(calls[0]!)).toBe(120);
  });

  it('falls back when a required relay has no hint', async () => {
    const calls: NostrFilter[] = [];
    await saveHint('warm-missing', relay, 120, 'under-half');

    await pageFor('warm-missing', {
      calls,
      relays: [relay, otherRelay],
      events: [event('a', 9_950)],
    });

    expect(span(calls[0]!)).toBe(60);
  });

  it('starts smaller from dense hints', async () => {
    const calls: NostrFilter[] = [];
    await saveHint('warm-dense', relay, 30, 'limit-hit');

    await pageFor('warm-dense', {
      calls,
      relays: [relay],
      events: [event('a', 9_990)],
    });

    expect(span(calls[0]!)).toBe(30);
  });

  it('does not suppress relay reads or exhaust history by hint alone', async () => {
    const calls: NostrFilter[] = [];
    await saveHint('warm-read', relay, 120, 'under-half');

    const page = await pageFor('warm-read', {
      calls,
      relays: [relay],
      events: [event('a', 9_950)],
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(page.hasMorePossible).toBe(true);
  });
});

async function saveHint(
  scanKey: string,
  relayUrl: string,
  recommendedSpanSeconds: number,
  lastFeedback: 'under-half' | 'limit-hit',
) {
  await saveFeedScanHint({
    scanKey,
    relayUrl,
    groupKey: 'group',
    filterKey,
    direction: 'older',
    recommendedSpanSeconds,
    lastSpanSeconds: 60,
    lastFeedback,
  });
}

function pageFor(
  key: string,
  input: {
    readonly calls: NostrFilter[];
    readonly relays: readonly string[];
    readonly events: readonly NostrEvent[];
  },
) {
  return readRelayFeedGroups({
    key,
    groups: [
      { key: 'group', relays: input.relays, authors: [], source: 'fallback' },
    ],
    filters: (_group, bounds) => [{ kinds: [1], ...bounds, limit: 10 }],
    direction: 'older',
    before: { createdAt: 10_000, id: 'f'.repeat(64) },
    pageSize: 1,
    subscriptions: subscriptions(input.events, input.calls),
  });
}

function subscriptions(
  events: readonly NostrEvent[],
  calls: NostrFilter[],
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      if (filter) calls.push(filter);
      const matching = events
        .filter((item) => matches(item, filter))
        .map((item) => ({
          event: item,
          relay: request.relays[0]!,
          subId: 'sub',
        }));
      return detailed(matching, request);
    },
  } as unknown as RelaySubscriptionManager;
}

function detailed(
  events: readonly PoolEvent[],
  request: RelayReadRequest,
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
      candidateCount: events.length,
      finalCount: events.length,
    })),
  };
}

function matches(event: NostrEvent, filter: NostrFilter | undefined): boolean {
  return (
    (!filter?.kinds || filter.kinds.includes(event.kind)) &&
    (filter?.since === undefined || event.created_at >= filter.since) &&
    (filter?.until === undefined || event.created_at < filter.until)
  );
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
