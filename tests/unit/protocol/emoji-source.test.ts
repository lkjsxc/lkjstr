import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEventRepositoryForTests,
  upsertEvent,
} from '../../../src/lib/events/repository';
import {
  emojiListKind,
  emojiSetKind,
  loadAccountEmojiSource,
} from '../../../src/lib/emoji/source';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('emoji source', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('loads the newest account list and newest referenced sets', async () => {
    const pubkey = 'a'.repeat(64);
    const address = `30030:${pubkey}:set`;
    await upsertEvent(
      event('1', pubkey, emojiListKind, 1, [
        ['emoji', 'old', 'https://emoji.example/old.png'],
      ]),
    );
    await upsertEvent(
      event('2', pubkey, emojiListKind, 2, [
        ['emoji', 'party', 'https://emoji.example/list.png'],
        ['a', address],
      ]),
    );
    await upsertEvent(
      event('3', pubkey, emojiSetKind, 3, [
        ['d', 'set'],
        ['emoji', 'blob-cat', 'https://emoji.example/old-set.png'],
      ]),
    );
    await upsertEvent(
      event('4', pubkey, emojiSetKind, 4, [
        ['d', 'set'],
        ['emoji', 'blob-cat', 'https://emoji.example/new-set.png'],
      ]),
    );

    expect(await loadAccountEmojiSource({ pubkey, relays: [] })).toEqual([
      {
        shortcode: 'blob-cat',
        url: 'https://emoji.example/new-set.png',
        address,
      },
      { shortcode: 'party', url: 'https://emoji.example/list.png' },
    ]);
  });

  it('dedupes choices by shortcode with later sources taking precedence', async () => {
    const pubkey = 'b'.repeat(64);
    const address = `30030:${pubkey}:set`;
    await upsertEvent(
      event('5', pubkey, emojiListKind, 5, [
        ['emoji', 'party', 'https://emoji.example/list.png'],
        ['a', address],
      ]),
    );
    await upsertEvent(
      event('6', pubkey, emojiSetKind, 6, [
        ['d', 'set'],
        ['emoji', 'party', 'https://emoji.example/set.png'],
      ]),
    );

    expect(await loadAccountEmojiSource({ pubkey, relays: [] })).toEqual([
      {
        shortcode: 'party',
        url: 'https://emoji.example/set.png',
        address,
      },
    ]);
  });
});

function event(
  seed: string,
  pubkey: string,
  kind: number,
  createdAt: number,
  tags: string[][],
): NostrEvent {
  return {
    id: seed.repeat(64),
    pubkey,
    created_at: createdAt,
    kind,
    tags,
    content: '',
    sig: seed.repeat(128),
  };
}
