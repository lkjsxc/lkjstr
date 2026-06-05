import { describe, expect, it } from 'vitest';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';
import {
  targetPostsOnlyAuthorSet,
  userTimelineAuthorSet,
} from '../../../src/lib/user-timeline/user-timeline-authors';

describe('user timeline authors', () => {
  it('builds target plus deduped followee authors', () => {
    const targetKey = generateSecretKey();
    const target = getPublicKey(targetKey);
    const a = getPublicKey(generateSecretKey());
    const b = getPublicKey(generateSecretKey());
    const followList = finalizeEvent(
      {
        kind: 3,
        created_at: 1,
        content: '',
        tags: [
          ['p', a],
          ['p', b],
          ['p', a],
          ['p', 'bad'],
        ],
      },
      targetKey,
    );
    expect(userTimelineAuthorSet({ targetPubkey: target, followList })).toEqual(
      {
        authors: [target, a, b],
        hash: [a, b, target].sort().join(','),
        mode: 'follow_graph',
      },
    );
  });

  it('builds explicit target-posts-only author set', () => {
    const target = getPublicKey(generateSecretKey());
    expect(targetPostsOnlyAuthorSet(target)).toEqual({
      authors: [target],
      hash: target,
      mode: 'target_posts_only',
    });
  });
});
