import { beforeEach, describe, expect, it } from 'vitest';
import {
  cachedThreadReactions,
  cachedThreadReposts,
  mergeReactionEvent,
  mergeRepostEvent,
  storeReaction,
  storeThreadActivity,
} from '../../../src/lib/thread/thread-reactions';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('thread reactions', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('loads and groups cached kind 7 reactions by event id', async () => {
    const target = 'f'.repeat(64);
    await storeReaction(reaction('1', target, '+', 'a'), 'wss://relay');
    await storeReaction(reaction('2', target, '+', 'b'), 'wss://relay');
    await storeReaction(reaction('3', target, '*', 'c'), 'wss://relay');

    expect(await cachedThreadReactions([target])).toEqual({
      [target]: [
        { content: '+', count: 2, actors: ['a'.repeat(64), 'b'.repeat(64)] },
        { content: '*', count: 1, actors: ['c'.repeat(64)] },
      ],
    });
  });

  it('merges live reactions without putting them in replies', () => {
    const target = 'f'.repeat(64);
    const map = mergeReactionEvent({}, reaction('1', target, '+', 'a'));
    expect(map[target]).toEqual([
      { content: '+', count: 1, actors: ['a'.repeat(64)] },
    ]);
  });

  it('loads and merges cached repost activity separately', async () => {
    const target = 'f'.repeat(64);
    await storeThreadActivity(repost('4', target, 'd'), 'wss://relay');
    await storeThreadActivity(repost('5', target, 'e'), 'wss://relay');

    expect(await cachedThreadReposts([target])).toEqual({
      [target]: { count: 2, actors: ['d'.repeat(64), 'e'.repeat(64)] },
    });
    expect(mergeRepostEvent({}, repost('6', target, 'a'))[target]).toEqual({
      count: 1,
      actors: ['a'.repeat(64)],
    });
  });
});

function reaction(
  idSeed: string,
  target: string,
  content: string,
  pubkeySeed: string,
): NostrEvent {
  return {
    id: idSeed.repeat(64),
    pubkey: pubkeySeed.repeat(64),
    created_at: Number(idSeed),
    kind: 7,
    tags: [['e', target]],
    content,
    sig: idSeed.repeat(128),
  };
}

function repost(
  idSeed: string,
  target: string,
  pubkeySeed: string,
): NostrEvent {
  return {
    id: idSeed.repeat(64),
    pubkey: pubkeySeed.repeat(64),
    created_at: Number(idSeed),
    kind: 6,
    tags: [['e', target]],
    content: '',
    sig: idSeed.repeat(128),
  };
}
