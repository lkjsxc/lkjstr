import { describe, expect, it } from 'vitest';
import { feedRowShells } from '../../../src/lib/feed-surface/row-shell';
import type { FeedEvent } from '../../../src/lib/events/types';

describe('feedRowShells', () => {
  it('returns shallow copies ready for immediate render', () => {
    const event = {
      event: {
        id: 'a',
        pubkey: 'p',
        created_at: 1,
        kind: 1,
        tags: [],
        content: 'hello',
        sig: 'sig',
      },
      relays: ['wss://relay'],
    } satisfies FeedEvent;
    const shells = feedRowShells([event]);
    expect(shells[0]?.event.content).toBe('hello');
    expect(shells[0]).not.toBe(event);
  });
});
