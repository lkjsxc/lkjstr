import { describe, expect, it } from 'vitest';
import {
  longPressCancelled,
  shouldActivateDrag,
  stripPriorityReorder,
} from '../../../src/lib/workspace/tab-strip-gesture';

describe('tab strip gestures', () => {
  it('requires long press on coarse pointers', () => {
    expect(shouldActivateDrag('coarse', 20, false)).toBe(false);
    expect(shouldActivateDrag('coarse', 20, true)).toBe(true);
    expect(shouldActivateDrag('fine', 6, false)).toBe(true);
  });

  it('cancels long press after movement', () => {
    expect(longPressCancelled(9)).toBe(true);
    expect(longPressCancelled(8)).toBe(false);
  });

  it('keeps strip priority inside the strip band', () => {
    expect(stripPriorityReorder(40, 48)).toBe(true);
    expect(stripPriorityReorder(60, 48)).toBe(false);
  });
});
