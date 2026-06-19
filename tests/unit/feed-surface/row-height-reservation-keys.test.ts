import { describe, expect, it } from 'vitest';
import {
  materializationTierForRowKey,
  widthBucketForPx,
} from '../../../src/lib/feed-surface/row-height-reservation-keys';

describe('row height reservation keys', () => {
  it('uses stable documented width buckets', () => {
    expect(widthBucketForPx(100)).toBe('0-319');
    expect(widthBucketForPx(320)).toBe('320-479');
    expect(widthBucketForPx(480)).toBe('480-639');
    expect(widthBucketForPx(640)).toBe('640-799');
    expect(widthBucketForPx(800)).toBe('800-1023');
    expect(widthBucketForPx(1024)).toBe('1024+');
  });

  it('derives materialization tier from the materialized row set', () => {
    const materialized = new Set(['event:visible']);
    const isMaterialized = (key: string): boolean => materialized.has(key);

    expect(materializationTierForRowKey('event:visible', isMaterialized)).toBe(
      'enriched',
    );
    expect(materializationTierForRowKey('event:hidden', isMaterialized)).toBe(
      'structural',
    );
  });
});
