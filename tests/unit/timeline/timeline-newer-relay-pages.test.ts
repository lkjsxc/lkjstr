import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEventRepositoryForTests,
  queryFeed,
} from '../../../src/lib/events/repository';
import type { RelayReadRequest } from '../../../src/lib/events/types';
import type { NostrEvent, NostrFilter } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import type { ReadPageResult } from '../../../src/lib/relays/read-page-status';
import type { RelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { loadNewerGlobalPage } from '../../../src/lib/timeline/global-timeline-pages';
import { loadNewerTimelinePage } from '../../../src/lib/timeline/timeline-runtime-paging';

const relay = 'wss://newer.example/';
const author = 'a'.repeat(64);

describe('timeline newer relay pages', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('loads Home newer events from relays and stores them', async () => {
    const now = Math.floor(Date.now() / 1000);
    const newer = event('home-newer', now - 5, author);
    const page = await loadNewerTimelinePage({
      items: [],
      authors: [author],
      relays: [relay],
      subId: 'home',
      cursor: { createdAt: now - 20, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: subscriptions([newer]),
    });

    expect(page.items.map((item) => item.event.id)).toEqual([newer.id]);
    expect(
      (await queryFeed({ kind: 'home', authors: [author], limit: 10 })).items[0]
        ?.event.id,
    ).toBe(newer.id);
  });

  it('loads Global newer events from relays and stores them', async () => {
    const now = Math.floor(Date.now() / 1000);
    const newer = event('global-newer', now - 5, author);
    const page = await loadNewerGlobalPage({
      items: [],
      relays: [relay],
      subId: 'global',
      cursor: { createdAt: now - 20, id: 'f'.repeat(64) },
      pageSize: 10,
      subscriptions: subscriptions([newer]),
    });

    expect(page.items.map((item) => item.event.id)).toEqual([newer.id]);
    expect(
      (await queryFeed({ kind: 'global', limit: 10 })).items[0]?.event.id,
    ).toBe(newer.id);
  });
});

function subscriptions(
  events: readonly NostrEvent[],
): RelaySubscriptionManager {
  return {
    readPageDetailed: async (request: RelayReadRequest) => {
      const filter = request.filters[0];
      const matching = events
        .filter((item) => matches(item, filter))
        .map((item) => ({
          event: item,
          relay: request.relays[0] ?? relay,
          subId: request.key,
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
      candidateCount: events.filter((item) => item.relay === url).length,
      finalCount: events.filter((item) => item.relay === url).length,
    })),
  };
}

function matches(event: NostrEvent, filter: NostrFilter | undefined): boolean {
  return (
    (!filter?.authors || filter.authors.includes(event.pubkey)) &&
    (!filter?.kinds || filter.kinds.includes(event.kind)) &&
    (filter?.since === undefined || event.created_at >= filter.since) &&
    (filter?.until === undefined || event.created_at <= filter.until)
  );
}

function event(seed: string, created_at: number, pubkey: string): NostrEvent {
  return {
    id: seed.repeat(64).slice(0, 64),
    pubkey,
    created_at,
    kind: 1,
    tags: [],
    content: seed,
    sig: 'b'.repeat(128),
  };
}
