import { describe, expect, it } from 'vitest';
import {
  activatePointerDrag,
  pointerDropZone,
  startPointerTabDrag,
} from '../../../src/lib/workspace/pointer-tab-drag';

describe('pointer tab drag', () => {
  it('activates only after the movement threshold', () => {
    const snapshot = startPointerTabDrag('pane', 'tab', 10, 10);
    expect(activatePointerDrag(snapshot, 12, 12).active).toBe(false);
    expect(activatePointerDrag(snapshot, 20, 10).active).toBe(true);
  });

  it('maps pane points to center and edge split zones', () => {
    const rect = { left: 0, top: 0, width: 300, height: 200 };
    expect(pointerDropZone(rect, 5, 100)).toBe('left');
    expect(pointerDropZone(rect, 295, 100)).toBe('right');
    expect(pointerDropZone(rect, 150, 5)).toBe('top');
    expect(pointerDropZone(rect, 150, 195)).toBe('bottom');
    expect(pointerDropZone(rect, 150, 100)).toBe('center');
  });
});
