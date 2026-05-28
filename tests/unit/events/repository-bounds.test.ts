import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEventRepositoryForTests,
  queryFeed,
  upsertEvent,
} from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('event repository display bounds', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('excludes rows before since', async () => {
    await upsertEvent(event('1', 9, 'old'));
    await upsertEvent(event('2', 10, 'edge'));
    await upsertEvent(event('3', 11, 'new'));

    const page = await queryFeed({ kind: 'global', since: 10, limit: 10 });

    expect(page.items.map((item) => item.event.content)).toEqual([
      'new',
      'edge',
    ]);
  });

  it('treats until as an exclusive local display bound', async () => {
    await upsertEvent(event('1', 9, 'inside'));
    await upsertEvent(event('2', 10, 'outside'));

    const page = await queryFeed({ kind: 'global', until: 10, limit: 10 });

    expect(page.items.map((item) => item.event.content)).toEqual(['inside']);
  });

  it('preserves same-second cursor ordering inside bounds', async () => {
    await upsertEvent(event('1', 10, 'first'));
    await upsertEvent(event('2', 10, 'second'));
    await upsertEvent(event('3', 10, 'third'));

    const first = await queryFeed({ kind: 'global', since: 10, limit: 2 });
    const second = await queryFeed({
      kind: 'global',
      since: 10,
      before: first.cursor?.oldest,
      limit: 2,
    });

    expect(
      [...first.items, ...second.items].map((item) => item.event.id),
    ).toEqual(['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)]);
  });
});

function event(
  idSeed: string,
  created_at: number,
  content: string,
): NostrEvent {
  return {
    id: idSeed.repeat(64).slice(0, 64),
    pubkey: idSeed.repeat(64).slice(0, 64),
    created_at,
    kind: 1,
    tags: [],
    content,
    sig: idSeed.repeat(128).slice(0, 128),
  };
}
