import { describe, expect, it } from 'vitest';
import {
  estimateFeedRowHeight,
  feedRowHeightReservationCount,
  recordFeedRowHeight,
} from '../../../src/lib/feed-surface/row-height-reservation';

describe('row height reservation', () => {
  it('uses measured heights for stable row keys', () => {
    const before = feedRowHeightReservationCount();
    expect(estimateFeedRowHeight({ key: 'event:a', item: { kind: 'event' } })).toBe(168);
    recordFeedRowHeight({ key: 'event:a', heightPx: 212.4 });
    expect(estimateFeedRowHeight({ key: 'event:a', item: { kind: 'event' } })).toBe(212);
    expect(feedRowHeightReservationCount()).toBeGreaterThanOrEqual(before + 1);
  });

  it('uses bounded real row kind fallbacks before measurement', () => {
    expect(estimateFeedRowHeight({ key: 'leading', item: { kind: 'leading' } })).toBe(220);
    expect(estimateFeedRowHeight({ key: 'empty', item: { kind: 'empty' } })).toBe(96);
    expect(estimateFeedRowHeight({ key: 'status', item: { kind: 'loadingOlder' } })).toBe(72);
  });
});
