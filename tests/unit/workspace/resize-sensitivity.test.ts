import { describe, expect, it } from 'vitest';
import { pointerDeltaToSplitRatio } from '../../../src/lib/workspace/resize';

describe('resize sensitivity', () => {
  it('uses container size and damping', () => {
    expect(pointerDeltaToSplitRatio(80, 800)).toBeCloseTo(0.18);
    expect(pointerDeltaToSplitRatio(80, 400)).toBeCloseTo(0.36);
  });

  it('ignores tiny movement and applies a minimum container size', () => {
    expect(pointerDeltaToSplitRatio(1, 800)).toBe(0);
    expect(pointerDeltaToSplitRatio(24, 0)).toBeCloseTo(0.18);
  });
});
