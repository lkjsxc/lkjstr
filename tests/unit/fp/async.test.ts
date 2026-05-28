import { describe, expect, it } from 'vitest';
import { mapAsyncBounded } from '../../../src/lib/fp/async';

describe('mapAsyncBounded', () => {
  it('preserves input order while running work concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapAsyncBounded([3, 2, 1], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });

    expect(result).toEqual([6, 4, 2]);
    expect(maxActive).toBe(2);
  });
});
