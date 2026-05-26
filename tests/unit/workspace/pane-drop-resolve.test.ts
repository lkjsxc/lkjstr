import { describe, expect, it } from 'vitest';
import { resolvePaneDrop } from '../../../src/lib/workspace/pane-drop-resolve';

const base = {
  paneRect: { left: 0, top: 0, width: 400, height: 400 },
  bodyRect: { left: 0, top: 80, width: 400, height: 320 },
  chromeBottom: 80,
  stripBottom: 72,
  sourcePaneId: 'pane-a',
  targetPaneId: 'pane-a',
  draggedTabId: 'tab-1',
  frames: [] as const,
};

describe('pane drop resolve', () => {
  it('uses center zone over the tab strip and pane head', () => {
    expect(resolvePaneDrop({ ...base, clientX: 200, clientY: 40 }).zone).toBe(
      'center',
    );
    expect(resolvePaneDrop({ ...base, clientX: 20, clientY: 75 }).zone).toBe(
      'center',
    );
  });

  it('uses center when pointer is above body but below chrome edge case', () => {
    const result = resolvePaneDrop({
      ...base,
      chromeBottom: 70,
      clientX: 200,
      clientY: 75,
    });
    expect(result.zone).toBe('center');
  });

  it('uses body edge zones below chrome', () => {
    expect(
      resolvePaneDrop({
        ...base,
        clientX: 10,
        clientY: 100,
        targetPaneId: 'pane-b',
      }).zone,
    ).toBe('left');
    expect(
      resolvePaneDrop({
        ...base,
        clientX: 200,
        clientY: 95,
        targetPaneId: 'pane-b',
      }).zone,
    ).toBe('top');
    expect(
      resolvePaneDrop({
        ...base,
        clientX: 200,
        clientY: 390,
        targetPaneId: 'pane-b',
      }).zone,
    ).toBe('bottom');
  });
});

describe('tab drop overlay offset', () => {
  it('offsets edge preview top by body offset', async () => {
    const { tabDropOverlayStyle } =
      await import('../../../src/lib/workspace/tab-drop-preview');
    const style = tabDropOverlayStyle({ width: 400, height: 320 }, 'top', 80);
    expect(style).toContain('--drop-top: 80px');
  });
});
