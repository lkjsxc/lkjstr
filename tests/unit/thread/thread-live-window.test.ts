import { describe, expect, it } from 'vitest';
import { threadWindowSize } from '../../../src/lib/events/feed-window';
import { mergeThreadWindow } from '../../../src/lib/thread/thread-store';

describe('thread live window', () => {
  it('bounds live thread inserts to the thread window', () => {
    const incoming = Array.from(
      { length: threadWindowSize + 7 },
      (_, index) => ({
        event: event(index),
        relays: ['relay'],
      }),
    );
    const bounded = mergeThreadWindow([], incoming, threadWindowSize);
    expect(bounded).toHaveLength(threadWindowSize);
    expect(bounded[0]?.event.content).toBe(`event ${threadWindowSize + 6}`);
    expect(bounded.at(-1)?.event.content).toBe('event 7');
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
