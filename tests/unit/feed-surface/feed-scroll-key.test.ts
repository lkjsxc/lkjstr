import { describe, expect, it } from 'vitest';
import {
  missingFeedRowKey,
  safeFeedRowKey,
} from '../../../src/lib/feed-surface/feed-scroll-key';

describe('feed scroll key guard', () => {
  it('does not call row key functions for virtua placeholder rows', () => {
    expect(
      safeFeedRowKey(undefined, () => {
        throw new Error('must not call getKey');
      }),
    ).toBe(missingFeedRowKey);
    expect(safeFeedRowKey(null, () => 'bad')).toBe(missingFeedRowKey);
  });

  it('delegates real rows to surface key functions', () => {
    expect(safeFeedRowKey({ kind: 'footer' }, () => 'footer')).toBe('footer');
  });
});
