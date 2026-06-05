import { describe, expect, it } from 'vitest';
import { contentShapeHash } from '../../../src/lib/feed-surface/feed-geometry-hash';

describe('feed geometry content shape hash', () => {
  it('matches the Rust FNV field order', () => {
    expect(
      contentShapeHash({
        contentLength: 10,
        unicodeScalarCount: 10,
        lineBreakCount: 1,
        longestUnbrokenTokenLength: 5,
        urlCount: 0,
        mediaCount: 0,
        referencePreviewCount: 0,
        customEmojiCount: 0,
        hasContentWarning: false,
        fragmentCount: 1,
      }),
    ).toBe('b917df0a9956a012');
  });
});
