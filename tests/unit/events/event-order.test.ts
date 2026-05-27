import { describe, expect, it } from 'vitest';
import {
  compareEventsNewestFirst,
  sortEventsNewestFirst,
} from '../../../src/lib/events/event-order';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('event-order', () => {
  it('sorts newest created_at first', () => {
    const older = event('a', 100);
    const newer = event('b', 200);
    expect(compareEventsNewestFirst(older, newer)).toBeGreaterThan(0);
    expect(sortEventsNewestFirst([older, newer]).map((item) => item.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('tie-breaks on event id', () => {
    const left = event('aaa', 100);
    const right = event('bbb', 100);
    expect(compareEventsNewestFirst(left, right)).toBeLessThan(0);
  });
});

function event(id: string, created_at: number): NostrEvent {
  return {
    id,
    pubkey: '11'.repeat(32),
    created_at,
    kind: 1,
    tags: [],
    content: id,
    sig: '22'.repeat(64),
  };
}
