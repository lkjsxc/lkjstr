import { describe, expect, it } from 'vitest';
import {
  activatePointerDrag,
  startPointerTabDrag,
  tabInsertionIndex,
} from '../../../src/lib/workspace/pointer-tab-drag';
import {
  tabDropEdge,
  tabDropOverlayRect,
  tabDropZone,
} from '../../../src/lib/workspace/tab-drop-zone';

describe('pointer tab drag', () => {
  it('activates only after the movement threshold', () => {
    const snapshot = startPointerTabDrag('pane', 'tab', 1, 10, 10);
    expect(activatePointerDrag(snapshot, 12, 12).active).toBe(false);
    expect(activatePointerDrag(snapshot, 20, 10).active).toBe(true);
  });

  it('maps pane points to center and edge split zones', () => {
    const rect = { left: 0, top: 0, width: 300, height: 200 };
    expect(tabDropZone(rect, 5, 100)).toBe('left');
    expect(tabDropZone(rect, 295, 100)).toBe('right');
    expect(tabDropZone(rect, 150, 5)).toBe('top');
    expect(tabDropZone(rect, 150, 195)).toBe('bottom');
    expect(tabDropZone(rect, 150, 100)).toBe('center');
  });

  it('maps zones to reducer edges and overlay geometry', () => {
    expect(tabDropEdge('center')).toBeUndefined();
    expect(tabDropEdge('left')).toBe('left');
    expect(tabDropOverlayRect({ width: 300, height: 200 }, 'right')).toEqual({
      left: 246,
      top: 0,
      width: 54,
      height: 200,
    });
  });

  it('computes pointer tab insertion indexes', () => {
    const frames = [
      { tabId: 'a', left: 0, width: 100 },
      { tabId: 'b', left: 100, width: 100 },
      { tabId: 'c', left: 200, width: 100 },
    ];
    expect(tabInsertionIndex(frames, 10)).toBe(0);
    expect(tabInsertionIndex(frames, 175)).toBe(2);
    expect(tabInsertionIndex(frames, 350)).toBe(3);
    expect(tabInsertionIndex(frames, 175, 'a')).toBe(1);
    expect(tabInsertionIndex(frames.slice(0, 2), 350, 'c')).toBe(2);
  });
});
