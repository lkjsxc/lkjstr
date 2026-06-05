import { describe, expect, it } from 'vitest';
import {
  clearFeedRowHeightsForKey,
  estimateFeedRowHeight,
  feedRowHeightReservationCount,
  recordFeedRowHeight,
  widthBucketForPx,
} from '../../../src/lib/feed-surface/row-height-reservation';

const eventId = 'a'.repeat(64);

function eventRow(content: string, tags: readonly (readonly string[])[] = []) {
  return {
    kind: 'event' as const,
    node: {
      depth: 1,
      event: {
        id: eventId,
        pubkey: 'b'.repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content,
        sig: 'c'.repeat(128),
      },
      relays: ['wss://relay.example'],
    },
  };
}

describe('row height reservation', () => {
  it('uses measured heights for stable geometry keys and width buckets', () => {
    const before = feedRowHeightReservationCount();
    const item = eventRow('short note');
    const fallback = estimateFeedRowHeight({
      key: 'event:a',
      item,
      widthPx: 360,
    });

    recordFeedRowHeight({
      key: 'event:a',
      item,
      widthPx: 360,
      heightPx: 212.4,
    });
    expect(estimateFeedRowHeight({ key: 'event:a', item, widthPx: 360 })).toBe(
      212,
    );
    expect(estimateFeedRowHeight({ key: 'event:a', item, widthPx: 900 })).toBe(
      fallback,
    );
    expect(feedRowHeightReservationCount()).toBeGreaterThanOrEqual(before + 1);
  });

  it('does not reuse a measurement after content shape changes', () => {
    const short = eventRow('short note');
    const long = eventRow('x'.repeat(20_000));
    recordFeedRowHeight({
      key: 'event:shape',
      item: short,
      widthPx: 640,
      heightPx: 120,
    });

    expect(
      estimateFeedRowHeight({ key: 'event:shape', item: short, widthPx: 640 }),
    ).toBe(120);
    expect(
      estimateFeedRowHeight({ key: 'event:shape', item: long, widthPx: 640 }),
    ).toBeGreaterThan(1_400);
  });

  it('uses content-aware fallbacks before measurement', () => {
    const short = estimateFeedRowHeight({
      key: 'short',
      item: eventRow('hello'),
      widthPx: 640,
    });
    const long = estimateFeedRowHeight({
      key: 'long',
      item: eventRow('x'.repeat(20_000)),
      widthPx: 640,
    });
    const breaks = estimateFeedRowHeight({
      key: 'breaks',
      item: eventRow('x\n'.repeat(300)),
      widthPx: 640,
    });
    const token = estimateFeedRowHeight({
      key: 'token',
      item: eventRow('y'.repeat(5_000)),
      widthPx: 320,
    });

    expect(long).toBeGreaterThan(short * 8);
    expect(breaks).toBeGreaterThan(short * 8);
    expect(token).toBeGreaterThan(1_400);
  });

  it('includes media, references, and custom emoji in the shape estimate', () => {
    const row = eventRow('hello https://example.test', [
      ['imeta', 'url https://example.test/a.png'],
      ['e', eventId],
      ['emoji', 'blobcat', 'https://example.test/blobcat.png'],
      ['content-warning', 'reason'],
    ]);

    expect(
      estimateFeedRowHeight({ key: 'rich', item: row, widthPx: 640 }),
    ).toBeGreaterThan(300);
  });

  it('uses bounded real row kind fallbacks before measurement', () => {
    expect(
      estimateFeedRowHeight({ key: 'leading', item: { kind: 'leading' } }),
    ).toBeGreaterThan(180);
    expect(
      estimateFeedRowHeight({ key: 'empty', item: { kind: 'empty' } }),
    ).toBe(72);
    expect(
      estimateFeedRowHeight({ key: 'status', item: { kind: 'loadingOlder' } }),
    ).toBe(64);
  });

  it('clears all width buckets for a destructive row change', () => {
    const item = eventRow('clear me');
    recordFeedRowHeight({
      key: 'event:clear',
      item,
      widthPx: 360,
      heightPx: 200,
    });
    recordFeedRowHeight({
      key: 'event:clear',
      item,
      widthPx: 900,
      heightPx: 100,
    });
    clearFeedRowHeightsForKey('event:clear');

    expect(
      estimateFeedRowHeight({ key: 'event:clear', item, widthPx: 360 }),
    ).not.toBe(200);
    expect(
      estimateFeedRowHeight({ key: 'event:clear', item, widthPx: 900 }),
    ).not.toBe(100);
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
