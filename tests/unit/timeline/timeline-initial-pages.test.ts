import { describe, expect, it } from 'vitest';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { loadInitialGlobalPage } from '../../../src/lib/timeline/global-timeline-pages';
import { loadInitialTimelinePage } from '../../../src/lib/timeline/timeline-runtime-paging';

describe('timeline initial relay pages', () => {
  it('bounds Home initial feed requests', async () => {
    const reads: RelayReadRequest[] = [];
    await loadInitialTimelinePage({
      authors: ['a'.repeat(64)],
      relays: ['wss://relay.example/'],
      subId: 'home-initial',
      pageSize: 30,
      subscriptions: subscriptions(reads),
    });

    expect(reads[0]?.filters[0]).toEqual(
      expect.objectContaining({
        since: expect.any(Number),
        until: expect.any(Number),
      }),
    );
  });

  it('uses per-filter Home author budgets when no author routes exist', async () => {
    const reads: RelayReadRequest[] = [];
    await loadInitialTimelinePage({
      authors: Array.from({ length: 401 }, (_, index) => pubkey(index)),
      relays: ['wss://relay.example/'],
      subId: 'home-initial',
      pageSize: 30,
      subscriptions: subscriptions(reads),
    });

    expect(reads.slice(0, 3).map((read) => read.filters[0]?.limit)).toEqual([
      30, 30, 30,
    ]);
    expect(reads.every((read) => read.filters[0]?.limit === 30)).toBe(true);
  });

  it('bounds Global initial feed requests', async () => {
    const reads: RelayReadRequest[] = [];
    await loadInitialGlobalPage({
      relays: ['wss://relay.example/'],
      subId: 'global-initial',
      pageSize: 30,
      subscriptions: subscriptions(reads),
    });

    expect(reads[0]?.filters[0]).toEqual(
      expect.objectContaining({
        since: expect.any(Number),
        until: expect.any(Number),
      }),
    );
  });
});

function subscriptions(reads: RelayReadRequest[]): RelaySubscriptionManager {
  return {
    readPageDetailed: async (
      request: RelayReadRequest,
    ): Promise<ReadPageResult> => {
      reads.push(request);
      return {
        events: [],
        statuses: request.relays.map((relay) => ({
          relay,
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
    },
  } as unknown as RelaySubscriptionManager;
}

function pubkey(index: number): string {
  return index.toString(16).padStart(64, '0');
}
