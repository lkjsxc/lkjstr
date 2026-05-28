import { describe, expect, it } from 'vitest';
import { shouldStartOlderPrefetch } from '../../../src/lib/feed-surface/older-prefetch';

const base = {
  mode: 'auto-near-end' as const,
  itemCount: 30,
  hasOlder: true,
  loadingOlder: false,
  cursorsReady: true,
  scrollOffset: 0,
  viewportSize: 800,
  scrollSize: 2200,
};

describe('older prefetch', () => {
  it('allows Home and Global style prefetch inside near-end threshold', () => {
    expect(shouldStartOlderPrefetch(base)).toBe(true);
  });

  it('requires rows, cursors, and auto near-end mode', () => {
    expect(shouldStartOlderPrefetch({ ...base, itemCount: 0 })).toBe(false);
    expect(shouldStartOlderPrefetch({ ...base, cursorsReady: false })).toBe(
      false,
    );
    expect(
      shouldStartOlderPrefetch({ ...base, mode: 'after-user-scroll' }),
    ).toBe(false);
  });

  it('blocks when the feed is outside the near-end threshold', () => {
    expect(shouldStartOlderPrefetch({ ...base, scrollSize: 5000 })).toBe(false);
  });
});
