import { describe, expect, it } from 'vitest';
import {
  paneIds,
  type WorkspaceLayoutNode,
} from '../../../src/lib/workspace/layout-tree';
import { moveWorkspaceTab } from '../../../src/lib/workspace/move-tab';
import {
  createWorkspace,
  openTab,
  splitFocusedPane,
} from '../../../src/lib/workspace/workspace';

describe('drag edge smart splits', () => {
  it('grows a horizontal split to three panes like repeated menu splits', () => {
    const base = splitFocusedPane(createWorkspace(), 'horizontal');
    const sourcePaneId = base.focusedPaneId!;
    const targetPaneId = paneIds(base.layout!).find(
      (id) => id !== sourcePaneId,
    )!;
    const withSourceTab = openTab(base, sourcePaneId, 'settings', 'Settings');
    const tabId = withSourceTab.focusedTabId!;
    const dragThird = moveWorkspaceTab(withSourceTab, {
      sourcePaneId,
      targetPaneId,
      tabId,
      targetIndex: 0,
      edge: 'right',
    });
    const withTargetTab = openTab(base, targetPaneId, 'settings', 'Settings');
    const menuThird = splitFocusedPane(withTargetTab, 'horizontal');
    expect(paneIds(dragThird.layout!).length).toBe(3);
    expect(paneIds(menuThird.layout!).length).toBe(3);
    expect(layoutShape(dragThird.layout!)).toEqual(
      layoutShape(menuThird.layout!),
    );
  });
});

function layoutShape(node: WorkspaceLayoutNode): unknown {
  if (node.type === 'pane') return 'pane';
  return {
    direction: node.direction,
    children: node.children.map(layoutShape),
    sizes: node.sizes,
  };
}
