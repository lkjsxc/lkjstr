import { describe, expect, it } from 'vitest';
import { followeeEntries } from '../../../src/lib/profile/followees';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('followeeEntries', () => {
  it('dedupes valid p tags and normalizes relay hints', () => {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    const entries = followeeEntries(
      event([
        ['p', alice, 'relay.example', 'Alice'],
        ['p', 'bad', 'wss://bad.example', 'Bad'],
        ['p', alice, 'wss://later.example', 'Later'],
        ['p', bob, 'https://relay.example/path//', ''],
      ]),
    );

    expect(entries).toEqual([
      { pubkey: alice, relayUrl: 'wss://relay.example/', petname: 'Alice' },
      { pubkey: bob, relayUrl: 'wss://relay.example/path' },
    ]);
  });
});

function event(tags: string[][]): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: '2'.repeat(64),
    created_at: 1,
    kind: 3,
    tags,
    content: '',
    sig: '3'.repeat(128),
  };
}
