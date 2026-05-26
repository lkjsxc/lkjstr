import { describe, expect, it } from 'vitest';
import {
  tabDropHitSize,
  tabDropZone,
} from '../../../src/lib/workspace/tab-drop-hit';
import {
  tabDropOverlayStyle,
  tabDropPreviewRect,
} from '../../../src/lib/workspace/tab-drop-preview';

describe('tab drop zones', () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };

  it('uses about 22 percent edge hit corridors', () => {
    expect(tabDropHitSize(200)).toBe(44);
    expect(tabDropZone(rect, 10, 50)).toBe('left');
    expect(tabDropZone(rect, 190, 50)).toBe('right');
  });

  it('renders half-pane edge previews', () => {
    const left = tabDropPreviewRect(rect, 'left');
    expect(left.width).toBe(100);
    expect(left.height).toBe(100);
    const bottom = tabDropPreviewRect(rect, 'bottom');
    expect(bottom.height).toBe(50);
    expect(bottom.top).toBe(50);
  });

  it('offsets center overlay below pane chrome', () => {
    const style = tabDropOverlayStyle(rect, 'center', 48);
    expect(style).toContain('--drop-top: 48px');
    expect(style).toContain('--drop-width: 200px');
    expect(style).toContain('--drop-height: 100px');
  });
});
