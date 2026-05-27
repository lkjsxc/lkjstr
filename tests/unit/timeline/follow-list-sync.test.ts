import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type NostrEvent,
} from '../../../src/lib/protocol';
import { describe, expect, it } from 'vitest';
import { selectLatestFollowList } from '../../../src/lib/timeline/follow-list-sync';

describe('follow-list sync', () => {
  it('selects the latest kind 3 follow list deterministically across relay permutations', () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);

    const eOld = finalizeEvent(
      { created_at: 100, kind: 3, tags: [], content: 'old' },
      activeKey,
    );
    const eNew = finalizeEvent(
      { created_at: 200, kind: 3, tags: [], content: 'new' },
      activeKey,
    );

    const irrelevant = finalizeEvent(
      { created_at: 300, kind: 1, tags: [], content: 'not-follow-list' },
      activeKey,
    );

    const permutations: NostrEvent[][] = [
      [eNew, eOld, irrelevant],
      [irrelevant, eOld, eNew],
      [eOld, eNew, irrelevant],
      [eOld, irrelevant, eNew],
    ];

    for (const events of permutations) {
      const selected = selectLatestFollowList(active, events);
      expect(selected?.id).toBe(eNew.id);
    }
  });

  it('returns undefined when there is no latest follow list kind 3', () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const other = generateSecretKey();

    const notForActive = finalizeEvent(
      { created_at: 200, kind: 3, tags: [], content: 'other-follow' },
      other,
    );
    const selected = selectLatestFollowList(active, [notForActive]);
    expect(selected).toBeUndefined();
  });
});
