import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { describe, expect, it } from 'vitest';
import {
  matchesAnyFilter,
  matchesFilter,
  parseFilter,
} from '../../../src/lib/protocol';

const event = finalizeEvent(
  {
    created_at: 100,
    kind: 1,
    tags: [
      ['p', 'a'.repeat(64)],
      ['t', 'deck'],
    ],
    content: 'hello',
  },
  generateSecretKey(),
);

describe('protocol filters', () => {
  it('parses valid filters', () => {
    expect(parseFilter({ kinds: [1], '#t': ['deck'], limit: 10 })).toEqual({
      kinds: [1],
      '#t': ['deck'],
      limit: 10,
    });
  });

  it('rejects malformed filters', () => {
    expect(parseFilter({ kinds: ['1'] })).toBeUndefined();
    expect(parseFilter({ ids: ['bad'] })).toBeUndefined();
  });

  it('matches conditions inside a filter with AND semantics', () => {
    expect(
      matchesFilter(event, {
        kinds: [1],
        '#t': ['deck'],
        since: 50,
        until: 100,
      }),
    ).toBe(true);
    expect(matchesFilter(event, { kinds: [0], '#t': ['deck'] })).toBe(false);
  });

  it('matches filter arrays with OR semantics', () => {
    expect(
      matchesAnyFilter(event, [
        { kinds: [0] },
        { authors: [event.pubkey.slice(0, 8)] },
      ]),
    ).toBe(true);
  });
});
