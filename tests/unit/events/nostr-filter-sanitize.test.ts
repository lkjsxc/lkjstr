import { describe, expect, it } from 'vitest';
import { relaySafeFilter } from '../../../src/lib/events/nostr-filter-sanitize';
import type { NostrFilter } from '../../../src/lib/protocol';

describe('nostr filter sanitization', () => {
  it('preserves relay protocol keys and single-letter tag filters', () => {
    const filter = {
      ids: ['a'.repeat(64)],
      authors: ['b'.repeat(64)],
      kinds: [1],
      since: 1,
      until: 2,
      limit: 3,
      search: 'nostr',
      '#e': ['c'.repeat(64)],
      '#A': ['kind:pubkey:identifier'],
      '#aa': ['d'],
      '#1': ['e'],
      depth: 2,
      span: 100,
      reason: 'dense',
      attempt: 1,
      groupKey: 'group',
      ignored: undefined,
    } as unknown as NostrFilter;

    expect(relaySafeFilter(filter)).toEqual({
      ids: ['a'.repeat(64)],
      authors: ['b'.repeat(64)],
      kinds: [1],
      since: 1,
      until: 2,
      limit: 3,
      search: 'nostr',
      '#e': ['c'.repeat(64)],
      '#A': ['kind:pubkey:identifier'],
    });
  });
});
