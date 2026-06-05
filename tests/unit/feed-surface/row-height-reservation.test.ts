import { describe, expect, it } from 'vitest';
import {
  clearFeedRowHeightsForKey,
  estimateFeedRowHeight,
  feedRowHeightReservationCount,
  recordFeedRowHeight,
  widthBucketForPx,
} from '../../../src/lib/feed-surface/row-height-reservation';

describe('row height reservation', () => {
  it('uses measured heights for stable row keys and width buckets', () => {
    const before = feedRowHeightReservationCount();
    expect(
      estimateFeedRowHeight({
        key: 'event:a',
        item: { kind: 'event' },
        widthPx: 360,
      }),
    ).toBe(168);
    recordFeedRowHeight({ key: 'event:a', widthPx: 360, heightPx: 212.4 });
    expect(
      estimateFeedRowHeight({
        key: 'event:a',
        item: { kind: 'event' },
        widthPx: 360,
      }),
    ).toBe(212);
    expect(
      estimateFeedRowHeight({
        key: 'event:a',
        item: { kind: 'event' },
        widthPx: 900,
      }),
    ).toBe(168);
    expect(feedRowHeightReservationCount()).toBeGreaterThanOrEqual(before + 1);
  });

  it('uses bounded real row kind fallbacks before measurement', () => {
    expect(
      estimateFeedRowHeight({ key: 'leading', item: { kind: 'leading' } }),
    ).toBe(220);
    expect(
      estimateFeedRowHeight({ key: 'empty', item: { kind: 'empty' } }),
    ).toBe(96);
    expect(
      estimateFeedRowHeight({ key: 'status', item: { kind: 'loadingOlder' } }),
    ).toBe(72);
  });

  it('clears all width buckets for a destructive row change', () => {
    recordFeedRowHeight({ key: 'event:clear', widthPx: 360, heightPx: 200 });
    recordFeedRowHeight({ key: 'event:clear', widthPx: 900, heightPx: 100 });
    clearFeedRowHeightsForKey('event:clear');
    expect(
      estimateFeedRowHeight({
        key: 'event:clear',
        item: { kind: 'event' },
        widthPx: 360,
      }),
    ).toBe(168);
    expect(
      estimateFeedRowHeight({
        key: 'event:clear',
        item: { kind: 'event' },
        widthPx: 900,
      }),
    ).toBe(168);
  });

  it('uses stable documented width buckets', () => {
    expect(widthBucketForPx(100)).toBe('0-319');
    expect(widthBucketForPx(320)).toBe('320-479');
    expect(widthBucketForPx(480)).toBe('480-639');
    expect(widthBucketForPx(640)).toBe('640-799');
    expect(widthBucketForPx(800)).toBe('800-1023');
    expect(widthBucketForPx(1024)).toBe('1024+');
  });
});
