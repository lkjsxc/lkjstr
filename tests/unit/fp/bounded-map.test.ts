import { describe, expect, it, vi } from 'vitest';
import { createBoundedMap } from '../../../src/lib/fp/bounded-map';

describe('bounded map', () => {
  it('evicts the oldest entry when max size is exceeded', () => {
    const map = createBoundedMap<string, number>({ maxSize: 2 });

    map.set('one', 1);
    map.set('two', 2);
    map.set('three', 3);

    expect(map.entries()).toEqual([
      ['two', 2],
      ['three', 3],
    ]);
  });

  it('expires stale entries on read', () => {
    vi.useFakeTimers();
    const map = createBoundedMap<string, number>({
      maxSize: 2,
      ttlMs: 1000,
    });

    map.set('one', 1);
    vi.advanceTimersByTime(1000);

    expect(map.get('one')).toBeUndefined();
    expect(map.size()).toBe(0);
    vi.useRealTimers();
  });
});
