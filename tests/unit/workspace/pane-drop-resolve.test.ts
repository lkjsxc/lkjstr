import { describe, expect, it } from 'vitest';
import { resolvePaneDrop } from '../../../src/lib/workspace/pane-drop-resolve';

describe('pane drop resolve', () => {
  it('uses center zone over the tab strip', () => {
    const result = resolvePaneDrop({
      paneRect: { left: 0, top: 0, width: 400, height: 400 },
      bodyRect: { left: 0, top: 80, width: 400, height: 320 },
      stripBottom: 80,
      clientX: 200,
      clientY: 40,
      sourcePaneId: 'pane-a',
      targetPaneId: 'pane-a',
      draggedTabId: 'tab-1',
      frames: [],
    });
    expect(result.zone).toBe('center');
    expect(result.edgeIntent).toBe(false);
  });

  it('uses body edge zones below the strip', () => {
    const result = resolvePaneDrop({
      paneRect: { left: 0, top: 0, width: 400, height: 400 },
      bodyRect: { left: 0, top: 80, width: 400, height: 320 },
      stripBottom: 80,
      clientX: 10,
      clientY: 200,
      sourcePaneId: 'pane-a',
      targetPaneId: 'pane-b',
      draggedTabId: 'tab-1',
      frames: [],
    });
    expect(result.zone).toBe('left');
    expect(result.edgeIntent).toBe(true);
  });
});
