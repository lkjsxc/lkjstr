import { describe, expect, it } from 'vitest';
import {
  feedWindowSize,
  mergeFeedWindowItems,
} from '../../../src/lib/events/feed-window';
import { upsertLive } from '../../../src/lib/timeline/timeline-state';

describe('timeline live windows', () => {
  it('bounds Home live inserts to the feed window', () => {
    const items = Array.from({ length: feedWindowSize + 3 }, (_, index) =>
      upsertLive([], event(index), 'relay'),
    ).flat();
    const bounded = items.reduce(
      (current, item) => upsertLive(current, item.event, 'relay'),
      [] as typeof items,
    );
    expect(bounded).toHaveLength(feedWindowSize);
    expect(bounded[0]?.event.content).toBe(`event ${feedWindowSize + 2}`);
  });

  it('bounds Global live merges to the feed window', () => {
    const incoming = Array.from({ length: feedWindowSize + 5 }, (_, index) => ({
      event: event(index),
      relays: ['relay'],
    }));
    const bounded = mergeFeedWindowItems([], incoming);
    expect(bounded).toHaveLength(feedWindowSize);
    expect(bounded.at(-1)?.event.content).toBe('event 5');
  });
});

function event(index: number) {
  const seed = index.toString(16).padStart(64, '0');
  return {
    id: seed,
    pubkey: 'a'.repeat(64),
    created_at: index,
    kind: 1,
    tags: [],
    content: `event ${index}`,
    sig: 'b'.repeat(128),
  };
}
