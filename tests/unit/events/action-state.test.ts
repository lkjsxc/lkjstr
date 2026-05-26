import { describe, expect, it } from 'vitest';
import { actionStateForFeed } from '../../../src/lib/events/action-state';
import { kinds } from '../../../src/lib/protocol';

describe('action state', () => {
  it('marks liked and reposted targets for the active account', () => {
    const targetId = 'target';
    const map = actionStateForFeed(
      [
        {
          event: {
            id: 'like',
            pubkey: 'me',
            created_at: 1,
            kind: kinds.reaction,
            tags: [['e', targetId]],
            content: '+',
            sig: 'sig',
          },
        },
        {
          event: {
            id: 'repost',
            pubkey: 'me',
            created_at: 2,
            kind: kinds.repost,
            tags: [['e', targetId]],
            content: '',
            sig: 'sig',
          },
        },
      ],
      'me',
    );
    expect(map.get(targetId)).toEqual({ liked: true, reposted: true });
  });
});
