import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEventRepositoryForTests,
  latestEventByAuthorKind,
  eventsByTagValue,
  lookupEvent,
  lookupEvents,
  queryFeed,
  upsertEvent,
} from '../../../src/lib/events/repository';
import { FeedWindow, isNearEnd } from '../../../src/lib/events/feed-window';
import { normalizeStoredEvent } from '../../../src/lib/events/normalize';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('event repository fallback paging', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('returns bounded pages with cursors and relay provenance', async () => {
    await upsertEvent(event('1', 3, 'a'), ['wss://relay-a']);
    await upsertEvent(event('2', 2, 'b'), ['wss://relay-b']);
    await upsertEvent(event('3', 1, 'c'), ['wss://relay-c']);

    const first = await queryFeed({ kind: 'global', limit: 2 });
    expect(first.items.map((item) => item.event.content)).toEqual(['a', 'b']);
    expect(first.items[0]?.relays).toEqual(['wss://relay-a']);
    expect(first.cursor?.oldest).toEqual({
      createdAt: 2,
      id: '2'.repeat(64),
    });
    expect(first.hasMore).toBe(true);

    const second = await queryFeed({
      kind: 'global',
      before: first.cursor?.oldest,
      limit: 2,
    });
    expect(second.items.map((item) => item.event.content)).toEqual(['c']);
    expect(second.hasMore).toBe(false);
  });

  it('uses event ids to page same-second events without gaps', async () => {
    await upsertEvent(event('1', 10, 'first'));
    await upsertEvent(event('2', 10, 'second'));
    await upsertEvent(event('3', 10, 'third'));

    const first = await queryFeed({ kind: 'global', limit: 2 });
    const second = await queryFeed({
      kind: 'global',
      before: first.cursor?.oldest,
      limit: 2,
    });

    expect(
      [...first.items, ...second.items].map((item) => item.event.id),
    ).toEqual(['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)]);
  });

  it('uses tag-backed semantics for thread pages', async () => {
    const root = 'f'.repeat(64);
    await upsertEvent(event('1', 10, 'root', [], root));
    await upsertEvent(event('2', 9, 'reply', [['e', root]]));
    await upsertEvent(event('3', 8, 'other', [['e', '0'.repeat(64)]]));

    const page = await queryFeed({ kind: 'thread', eventId: root, limit: 10 });
    expect(page.items.map((item) => item.event.content)).toEqual([
      'root',
      'reply',
    ]);
  });

  it('returns latest events by author and kind', async () => {
    const pubkey = 'a'.repeat(64);
    await upsertEvent({ ...event('1', 10, 'old'), pubkey, kind: 3 });
    await upsertEvent({ ...event('2', 20, 'new'), pubkey, kind: 3 });
    await upsertEvent({ ...event('3', 30, 'note'), pubkey, kind: 1 });

    const latest = await latestEventByAuthorKind(pubkey, 3);
    expect(latest?.event.content).toBe('new');
  });

  it('uses direct and batch id lookups', async () => {
    await upsertEvent(event('1', 10, 'one'));
    await upsertEvent(event('2', 9, 'two'));

    expect((await lookupEvent('1'.repeat(64)))?.event.content).toBe('one');
    expect(
      (await lookupEvents(['2'.repeat(64), 'missing'])).map(
        (item) => item.event.content,
      ),
    ).toEqual(['two']);
  });

  it('returns indexed tag-value events', async () => {
    const root = 'f'.repeat(64);
    await upsertEvent(event('1', 10, 'reaction', [['e', root]]));
    await upsertEvent(event('2', 9, 'other', [['e', '0'.repeat(64)]]));

    expect(
      (await eventsByTagValue('e', root)).map((item) => item.event.content),
    ).toEqual(['reaction']);
  });

  it('normalizes stale stored rows with cache relay provenance', () => {
    const stored = normalizeStoredEvent({
      ...event('4', 7, 'legacy'),
      receivedAt: undefined,
      relayUrls: undefined,
    });
    expect(stored.receivedAt).toBe(0);
    expect(stored.relayUrls).toEqual(['cache']);
  });

  it('detects near-end scrolling from offset, viewport, and total size', () => {
    expect(isNearEnd(100, 200, 1500, 300)).toBe(false);
    expect(isNearEnd(1000, 250, 1500, 300)).toBe(true);
  });

  it('prunes feed windows and exposes compound cursors', () => {
    const window = new FeedWindow<{ event: NostrEvent; relays: string[] }>(2);
    const snapshot = window.merge([
      { event: event('1', 10, 'new'), relays: ['a'] },
      { event: event('2', 9, 'mid'), relays: ['b'] },
      { event: event('3', 8, 'old'), relays: ['c'] },
    ]);
    expect(snapshot.items.map((item) => item.event.content)).toEqual([
      'new',
      'mid',
    ]);
    expect(snapshot.prunedOlder).toBe(true);
    expect(snapshot.oldestCursor).toEqual({
      createdAt: 9,
      id: '2'.repeat(64),
    });
  });
});

function event(
  idSeed: string,
  created_at: number,
  content: string,
  tags: string[][] = [],
  id = idSeed.repeat(64).slice(0, 64),
): NostrEvent {
  return {
    id,
    pubkey: idSeed.repeat(64).slice(0, 64),
    created_at,
    kind: 1,
    tags,
    content,
    sig: idSeed.repeat(128).slice(0, 128),
  };
}
