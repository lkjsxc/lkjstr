import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEventRepositoryForTests,
  queryFeed,
  upsertEvent,
} from '../../../src/lib/events/repository';
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
    expect(first.cursor?.until).toBe(2);
    expect(first.hasMore).toBe(true);

    const second = await queryFeed({
      kind: 'global',
      until: first.cursor?.until,
      limit: 2,
    });
    expect(second.items.map((item) => item.event.content)).toEqual(['c']);
    expect(second.hasMore).toBe(false);
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
