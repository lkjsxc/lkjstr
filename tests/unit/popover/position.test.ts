import { describe, expect, it } from 'vitest';
import { computeAnchoredPosition } from '../../../src/lib/components/popover/position';

describe('computeAnchoredPosition', () => {
  it('prefers bottom-start placement for event emoji palettes', () => {
    const result = computeAnchoredPosition({
      anchor: {
        top: 100,
        left: 200,
        right: 240,
        bottom: 132,
        width: 40,
        height: 32,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect,
      popover: { width: 280, height: 320 },
      viewport: { width: 800, height: 600 },
      preferred: 'bottom-start',
      gap: 6,
    });

    expect(result.placement).toBe('bottom-start');
    expect(result.left).toBe(200);
    expect(result.top).toBeGreaterThanOrEqual(132);
  });
});
