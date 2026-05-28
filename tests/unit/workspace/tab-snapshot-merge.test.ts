import { describe, expect, it } from 'vitest';
import { mergeTabSnapshotPayload } from '../../../src/lib/workspace/tab-snapshot-merge';

describe('mergeTabSnapshotPayload', () => {
  it('merges feed cursors into a feed snapshot', () => {
    const merged = mergeTabSnapshotPayload(
      { kind: 'feed', scrollTop: 10 },
      {
        oldestCursor: { createdAt: 5, id: 'x' },
        hasOlder: false,
        historyExhaustion: 'proven',
        anchorKey: 'row:x',
      },
    );
    expect(merged.kind).toBe('feed');
    if (merged.kind === 'feed') {
      expect(merged.oldestCursor?.id).toBe('x');
      expect(merged.hasOlder).toBe(false);
      expect(merged.historyExhaustion).toBe('proven');
      expect(merged.anchorKey).toBe('row:x');
      expect(merged.scrollTop).toBe(10);
    }
  });

  it('preserves falsy primitive values from snapshot patches', () => {
    const merged = mergeTabSnapshotPayload(
      { kind: 'feed', scrollTop: 25, hasOlder: true },
      { scrollTop: 0, hasOlder: false, eventIds: [] },
    );

    expect(merged.scrollTop).toBe(0);
    expect(merged.kind).toBe('feed');
    if (merged.kind === 'feed') {
      expect(merged.hasOlder).toBe(false);
      expect(merged.eventIds).toEqual([]);
    }
  });
});
