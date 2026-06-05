import { describe, expect, it } from 'vitest';
import { authorFilters } from '../../../src/lib/timeline/follow-list';
import { userTimelineAuthorSet } from '../../../src/lib/user-timeline/user-timeline-authors';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('user timeline author chunking', () => {
  it('builds a deduped target author set without requiring an account', () => {
    const set = userTimelineAuthorSet({
      targetPubkey: 'f'.repeat(64),
      followList: followList(3),
    });
    expect(set.authors[0]).toBe('f'.repeat(64));
    expect(new Set(set.authors).size).toBe(set.authors.length);
  });

  it('chunks huge follow graphs into bounded per-filter reads', () => {
    const set = userTimelineAuthorSet({
      targetPubkey: 'f'.repeat(64),
      followList: followList(450),
    });
    const filters = authorFilters(set.authors, 30, {}, 'per-filter');

    expect(filters.length).toBeGreaterThan(1);
    expect(
      filters.every((filter) => (filter.authors?.length ?? 0) <= 200),
    ).toBe(true);
    expect(filters.every((filter) => filter.limit === 30)).toBe(true);
  });
});

function followList(count: number): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: 'f'.repeat(64),
    sig: '2'.repeat(128),
    kind: 3,
    tags: Array.from({ length: count }, (_, index) => [
      'p',
      index.toString(16).padStart(64, '0'),
    ]),
    created_at: 1,
    content: '',
  };
}
