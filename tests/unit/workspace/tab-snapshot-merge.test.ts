import { describe, expect, it } from 'vitest';
import { mergeTabSnapshotPayload } from '../../../src/lib/workspace/tab-snapshot-merge';

describe('mergeTabSnapshotPayload', () => {
  it('merges feed cursors into a feed snapshot', () => {
    const merged = mergeTabSnapshotPayload(
      { kind: 'feed', scrollTop: 10 },
      {
        oldestCursor: { createdAt: 5, id: 'x' },
        hasOlder: false,
      },
    );
    expect(merged.kind).toBe('feed');
    if (merged.kind === 'feed') {
      expect(merged.oldestCursor?.id).toBe('x');
      expect(merged.hasOlder).toBe(false);
      expect(merged.scrollTop).toBe(10);
    }
  });
});
