import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import {
  clearFeedCoverageForTests,
  saveFeedCoverage,
} from '../../../src/lib/events/feed-coverage-store';
import { semanticFilterKey } from '../../../src/lib/events/relay-page-scan-diagnostics';
import { authorFilters } from '../../../src/lib/timeline/follow-list';
import { loadOlderTimelinePage } from '../../../src/lib/timeline/timeline-runtime-paging';
import { planTimelinePageIntent } from '../../../src/lib/relays/orchestration/page-reads';
import type { SubscriptionOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator-types';

const relay = 'wss://relay.example/';

describe('timeline cache-first paging', () => {
  beforeEach(() => {
    clearEventRepositoryForTests();
    clearFeedCoverageForTests();
  });

  it('returns a covered older page without relay reads', async () => {
    const key = generateSecretKey();
    const author = getPublicKey(key);
    const now = Math.floor(Date.now() / 1000) - 5;
    const event = finalizeEvent(
      { created_at: now - 10, kind: 1, tags: [], content: 'warm note' },
      key,
    );
    await upsertEvent(event, [relay]);
    const plan = await planTimelinePageIntent({
      surface: 'home',
      owner: 'unit-cache-first',
      phase: 'page',
      selectedRelays: [relay],
      authors: [author],
      pageSize: 10,
      direction: 'older',
      cursor: { createdAt: now, id: 'f'.repeat(64) },
      filters: (group, bounds) =>
        authorFilters(group.authors ?? [], 10, bounds),
    });
    for (const group of plan.groups)
      for (const relayUrl of group.relays)
        await saveFeedCoverage({
          feedKey: plan.key,
          groupKey: group.key,
          relayUrl,
          filterKey: semanticFilterKey(
            authorFilters(group.authors ?? [], 10, {})[0]!,
          ),
          status: 'complete',
          since: 0,
          until: now + 2,
        });

    const calls: string[] = [];
    const result = await loadOlderTimelinePage({
      surface: 'home',
      owner: 'unit-cache-first',
      items: [],
      authors: [author],
      relays: [relay],
      cursor: { createdAt: now, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: noRelayReads(calls),
    });

    expect(result.items.map((item) => item.event.content)).toEqual([
      'warm note',
    ]);
    expect(calls).toEqual([]);
  });
});

function noRelayReads(calls: string[]): SubscriptionOrchestrator {
  return {
    readPage: async () => {
      calls.push('readPage');
      return [];
    },
    readPageDetailed: async () => {
      calls.push('readPageDetailed');
      return {
        events: [],
        statuses: [],
        complete: true,
        density: { hitLimit: false, underHalfLimit: true },
      } as never;
    },
  } as unknown as SubscriptionOrchestrator;
}
