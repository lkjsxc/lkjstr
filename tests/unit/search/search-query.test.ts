import { beforeEach, describe, expect, it } from 'vitest';
import { searchPage } from '../../../src/lib/search/search-query';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';
import { stubOrchestrator } from '../relays/orchestration/orchestrator-mock';

describe('search query', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('returns no results for an empty query', async () => {
    const page = await searchPage({
      query: '   ',
      relays: [],
      owner: 'search',
      subscriptions: fakeSubscriptions([]),
      limit: 10,
    });

    expect(page).toEqual({ items: [], hasOlder: false });
  });

  it('uses compound cursors for same-second cached paging', async () => {
    await upsertEvent(event('0'.repeat(63) + '1', 100, 'nostr first'));
    await upsertEvent(event('0'.repeat(63) + '2', 100, 'nostr second'));

    const first = await searchPage({
      query: 'nostr',
      relays: [],
      owner: 'search',
      subscriptions: fakeSubscriptions([]),
      limit: 1,
    });
    const second = await searchPage({
      query: 'nostr',
      relays: [],
      owner: 'search',
      subscriptions: fakeSubscriptions([]),
      limit: 1,
      before: {
        createdAt: first.items[0]!.event.created_at,
        id: first.items[0]!.event.id,
      },
    });

    expect(first.items.map((item) => item.event.id)).toEqual([
      '0'.repeat(63) + '1',
    ]);
    expect(second.items.map((item) => item.event.id)).toEqual([
      '0'.repeat(63) + '2',
    ]);
  });

  it('merges cached and relay results by event id', async () => {
    const cached = event('0'.repeat(63) + '1', 101, 'nostr cached');
    const relay = event('0'.repeat(63) + '2', 102, 'nostr relay');
    await upsertEvent(cached, ['wss://cache.example/']);

    const page = await searchPage({
      query: 'nostr',
      relays: ['wss://relay.example/'],
      owner: 'search',
      subscriptions: fakeSubscriptions([
        { relay: 'wss://relay.example/', subId: 'search', event: cached },
        { relay: 'wss://relay.example/', subId: 'search', event: relay },
      ]),
      limit: 10,
    });

    expect(page.items.map((item) => item.event.id)).toEqual([
      relay.id,
      cached.id,
    ]);
    expect(
      page.items.find((item) => item.event.id === cached.id)?.relays,
    ).toEqual(['wss://cache.example/', 'wss://relay.example/']);
  });
});

function fakeSubscriptions(events: PoolEvent[]) {
  return stubOrchestrator({
    readPage: async () => events,
    readPageDetailed: async () => ({ events, statuses: [] }),
  });
}

function event(id: string, created_at: number, content: string): NostrEvent {
  return {
    id,
    sig: '1'.repeat(128),
    pubkey: '2'.repeat(64),
    kind: 1,
    tags: [],
    created_at,
    content,
  };
}
