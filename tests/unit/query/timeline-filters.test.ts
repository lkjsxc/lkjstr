import { describe, expect, it } from 'vitest';
import {
  assertRelayFilterIsProtocolSafe,
  buildTimelineFilters,
} from '../../../src/lib/query/timeline-filters';

describe('timeline-filters', () => {
  it('builds home filters from follows plus active account', () => {
    const filters = buildTimelineFilters({
      kind: 'home',
      activePubkey: 'aa'.repeat(32),
      followPubkeys: ['bb'.repeat(32)],
      cursor: {},
      limit: 30,
    });
    expect(filters.length).toBeGreaterThan(0);
    expect(filters[0]?.authors).toEqual(
      expect.arrayContaining(['aa'.repeat(32), 'bb'.repeat(32)]),
    );
  });

  it('returns no home filters when follows are empty', () => {
    expect(
      buildTimelineFilters({
        kind: 'home',
        activePubkey: 'aa'.repeat(32),
        followPubkeys: [],
        cursor: {},
        limit: 30,
      }),
    ).toEqual([]);
  });

  it('builds global filters without authors', () => {
    const filters = buildTimelineFilters({
      kind: 'global',
      cursor: { since: 1 },
      limit: 30,
    });
    expect(filters[0]?.authors).toBeUndefined();
    expect(filters[0]?.kinds).toEqual([1, 6, 16]);
  });

  it('rejects protocol-unsafe keys', () => {
    expect(() =>
      assertRelayFilterIsProtocolSafe({
        kinds: [1],
        depth: 1,
      } as never),
    ).toThrow(/protocol-unsafe/);
  });
});
