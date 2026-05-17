import { describe, expect, it } from 'vitest';
import { createPane } from '../../../src/lib/workspace/pane';
import { createSplit } from '../../../src/lib/workspace/layout-tree';
import {
  equalizeSplit,
  resizeHere,
  setSplitRatios,
} from '../../../src/lib/workspace/resize';

describe('N-way resize', () => {
  it('resizes adjacent siblings in a five-way split', () => {
    const split = createSplit(
      'horizontal',
      Array.from({ length: 5 }, (_, i) => createPane(`g-${i}`)),
    );
    const resized = resizeHere(split, 3, 0.05);
    expect(resized.sizes[0]).toBeCloseTo(0.2);
    expect(resized.sizes[3]).toBeGreaterThan(0.2);
    expect(resized.sizes[4]).toBeLessThan(0.2);
  });

  it('equalizes and normalizes N-way ratios', () => {
    const split = createSplit(
      'vertical',
      Array.from({ length: 5 }, (_, i) => createPane(`g-${i}`)),
    );
    const changed = setSplitRatios(split, split.id, [2, 1, 1, 1, 1]);
    if (changed.type !== 'split') throw new Error('expected split');
    expect(changed.sizes.reduce((sum, size) => sum + size, 0)).toBeCloseTo(1);
    const equal = equalizeSplit(changed, split.id);
    if (equal.type !== 'split') throw new Error('expected split');
    expect(equal.sizes).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
  });
});
