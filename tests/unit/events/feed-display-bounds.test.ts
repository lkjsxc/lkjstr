import { describe, expect, it } from 'vitest';
import {
  eventInDisplayBounds,
  feedEventsInDisplayBounds,
} from '../../../src/lib/events/feed-display-bounds';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('feed display bounds', () => {
  it('rejects future events and enforces since and exclusive until', () => {
    expect(eventInDisplayBounds(event('now', 10), { now: 10 })).toBe(true);
    expect(eventInDisplayBounds(event('future', 11), { now: 10 })).toBe(false);
    expect(eventInDisplayBounds(event('old', 9), { since: 10, now: 20 })).toBe(
      false,
    );
    expect(
      eventInDisplayBounds(event('until', 10), { until: 10, now: 20 }),
    ).toBe(false);
  });

  it('enforces compound before and after cursors before rows display', () => {
    const items = ['1', '2', '3'].map((seed) => ({
      event: event(seed, 10),
      relays: ['wss://relay.example/'],
    }));

    expect(
      feedEventsInDisplayBounds(items, {
        before: { createdAt: 10, id: '2'.repeat(64) },
        now: 10,
      }).map((item) => item.event.id),
    ).toEqual(['3'.repeat(64)]);
    expect(
      feedEventsInDisplayBounds(items, {
        after: { createdAt: 10, id: '2'.repeat(64) },
        now: 10,
      }).map((item) => item.event.id),
    ).toEqual(['1'.repeat(64)]);
  });
});

function event(seed: string, created_at: number): NostrEvent {
  return {
    id: seed
      .repeat(64)
      .slice(0, 64)
      .padEnd(64, seed.at(0) ?? '0'),
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: '',
    sig: 'b'.repeat(128),
  };
}
