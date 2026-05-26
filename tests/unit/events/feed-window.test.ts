import { describe, expect, it } from 'vitest';
import {
  isNearEnd,
  nearEndThreshold,
  nearEndPixels,
} from '../../../src/lib/events/feed-window';

describe('feed window thresholds', () => {
  it('uses the larger of base pixels and viewport fraction', () => {
    expect(nearEndThreshold(400)).toBe(nearEndPixels);
    expect(nearEndThreshold(2000)).toBe(4000);
  });

  it('detects near end with viewport-aware threshold', () => {
    expect(isNearEnd(0, 800, 1000, nearEndThreshold(800))).toBe(true);
    expect(isNearEnd(0, 800, 5000, nearEndThreshold(800))).toBe(false);
  });
});
