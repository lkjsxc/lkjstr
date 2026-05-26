import { describe, expect, it } from 'vitest';
import { nearEndThreshold } from '../../../src/lib/events/feed-window';
import { nearEndRootMargin } from '../../../src/lib/feed-surface/near-end';

describe('nearEndThreshold', () => {
  it('uses at least two viewport heights', () => {
    expect(nearEndThreshold(400)).toBe(1200);
    expect(nearEndThreshold(800)).toBe(1600);
  });

  it('formats root margin for observers', () => {
    expect(nearEndRootMargin(800)).toBe('1600px');
  });
});
