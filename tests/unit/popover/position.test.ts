import { describe, expect, it } from 'vitest';
import { computeAnchoredPosition } from '../../../src/lib/components/popover/position';

function rect(partial: Partial<DOMRect>): DOMRect {
  return {
    x: partial.left ?? 0,
    y: partial.top ?? 0,
    width: partial.width ?? 20,
    height: partial.height ?? 20,
    top: partial.top ?? 0,
    right: partial.right ?? 0,
    bottom: partial.bottom ?? 0,
    left: partial.left ?? 0,
    toJSON: () => ({}),
  };
}

describe('anchored popover position', () => {
  it('uses the clicked anchor rect', () => {
    const position = computeAnchoredPosition({
      anchor: rect({ top: 40, left: 80, right: 120, bottom: 60 }),
      popover: { width: 100, height: 80 },
      viewport: { width: 500, height: 500 },
      preferred: 'bottom-end',
      gap: 6,
    });
    expect(position).toMatchObject({ top: 66, left: 20 });
  });

  it('clamps and flips near viewport edges', () => {
    const position = computeAnchoredPosition({
      anchor: rect({ top: 460, left: 490, right: 510, bottom: 480 }),
      popover: { width: 120, height: 80 },
      viewport: { width: 520, height: 500 },
      preferred: 'bottom-end',
      gap: 6,
    });
    expect(position.placement).toBe('top-end');
    expect(position.left).toBeLessThanOrEqual(392);
    expect(position.top).toBe(374);
  });
});
