import { describe, expect, it } from 'vitest';
import type { FeedEvent } from '../../../src/lib/events/types';
import {
  scopedFeedActionOptimistic,
  type FeedActionOptimisticScope,
} from '../../../src/lib/components/events/feed-action-states-bridge-plan';

describe('feed action states bridge plan', () => {
  it('resets optimistic action state when the active account changes', () => {
    const current: FeedActionOptimisticScope = {
      pubkey: 'alice',
      optimistic: new Map([['event-a', { liked: true, reposted: false }]]),
    };

    const next = scopedFeedActionOptimistic(current, 'bob', [
      feedEvent('event-a'),
    ]);

    expect(next.pubkey).toBe('bob');
    expect(next.optimistic.size).toBe(0);
  });

  it('keeps only optimistic state for currently visible events', () => {
    const current: FeedActionOptimisticScope = {
      pubkey: 'alice',
      optimistic: new Map([
        ['event-a', { liked: true, reposted: false }],
        ['event-b', { liked: false, reposted: true }],
      ]),
    };

    const next = scopedFeedActionOptimistic(current, 'alice', [
      feedEvent('event-b'),
    ]);

    expect([...next.optimistic]).toEqual([
      ['event-b', { liked: false, reposted: true }],
    ]);
  });
});

function feedEvent(id: string): FeedEvent {
  return {
    event: {
      id,
      pubkey: 'pubkey',
      created_at: 1,
      kind: 1,
      tags: [],
      content: '',
      sig: 'sig',
    },
    relays: [],
  };
}
