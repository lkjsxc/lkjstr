import { describe, expect, it } from 'vitest';
import { findPane, paneIds } from '../../../src/lib/workspace/layout-tree';
import { moveWorkspaceTab } from '../../../src/lib/workspace/move-tab';
import {
  createWorkspace,
  openTab,
  splitFocusedPane,
  type Workspace,
} from '../../../src/lib/workspace/workspace';

describe('workspace tab movement', () => {
  it('reorders tabs in the same pane', () => {
    const workspace = openTab(
      openTab(createWorkspace(), null, 'settings', 'Settings'),
      null,
      'notifications',
      'Notifications',
    );
    const paneId = workspace.focusedPaneId!;
    const group = groupForPane(workspace, paneId);
    const movedTabId = group.tabIds[0]!;
    const moved = moveWorkspaceTab(workspace, {
      sourcePaneId: paneId,
      targetPaneId: paneId,
      tabId: movedTabId,
      targetIndex: 2,
    });
    expect(groupForPane(moved, paneId).tabIds.at(-1)).toBe(movedTabId);
    expect(moved.focusedTabId).toBe(movedTabId);
  });

  it('moves a tab across panes without closing a non-empty source', () => {
    const split = splitFocusedPane(createWorkspace(), 'horizontal');
    const sourcePaneId = split.focusedPaneId!;
    const opened = openTab(split, sourcePaneId, 'settings', 'Settings');
    const targetPaneId = paneIds(opened.layout!).find(
      (id) => id !== sourcePaneId,
    )!;
    const tabId = opened.focusedTabId!;
    const moved = moveWorkspaceTab(opened, {
      sourcePaneId,
      targetPaneId,
      tabId,
      targetIndex: 1,
    });
    expect(paneIds(moved.layout!)).toHaveLength(2);
    expect(groupForPane(moved, sourcePaneId).tabIds).not.toContain(tabId);
    expect(groupForPane(moved, targetPaneId).tabIds).toContain(tabId);
    expect(moved.focusedPaneId).toBe(targetPaneId);
  });

  it('removes the source pane when its last tab moves out', () => {
    const split = splitFocusedPane(createWorkspace(), 'horizontal');
    const sourcePaneId = split.focusedPaneId!;
    const targetPaneId = paneIds(split.layout!).find(
      (id) => id !== sourcePaneId,
    )!;
    const tabId = split.focusedTabId!;
    const moved = moveWorkspaceTab(split, {
      sourcePaneId,
      targetPaneId,
      tabId,
      targetIndex: 1,
    });
    expect(paneIds(moved.layout!)).toEqual([targetPaneId]);
    expect(
      moved.tabGroups[findPane(split.layout!, sourcePaneId)!.tabGroupId],
    ).toBeUndefined();
    expect(groupForPane(moved, targetPaneId).tabIds).toContain(tabId);
  });

  it('splits a target pane on edge drop and focuses the moved tab', () => {
    const split = splitFocusedPane(createWorkspace(), 'horizontal');
    const sourcePaneId = split.focusedPaneId!;
    const opened = openTab(split, sourcePaneId, 'settings', 'Settings');
    const targetPaneId = paneIds(opened.layout!).find(
      (id) => id !== sourcePaneId,
    )!;
    const tabId = opened.focusedTabId!;
    const moved = moveWorkspaceTab(opened, {
      sourcePaneId,
      targetPaneId,
      tabId,
      targetIndex: 0,
      edge: 'left',
    });
    expect(paneIds(moved.layout!)).toHaveLength(3);
    expect(moved.focusedTabId).toBe(tabId);
    expect(groupForPane(moved, moved.focusedPaneId!).tabIds).toEqual([tabId]);
  });

  it('ignores same-pane edge drops for a last-tab pane', () => {
    const workspace = createWorkspace();
    const moved = moveWorkspaceTab(workspace, {
      sourcePaneId: workspace.focusedPaneId!,
      targetPaneId: workspace.focusedPaneId!,
      tabId: workspace.focusedTabId!,
      targetIndex: 0,
      edge: 'right',
    });
    expect(moved).toBe(workspace);
  });

  it('clamps center drop target indexes', () => {
    const workspace = openTab(
      openTab(createWorkspace(), null, 'settings', 'Settings'),
      null,
      'notifications',
      'Notifications',
    );
    const paneId = workspace.focusedPaneId!;
    const tabId = groupForPane(workspace, paneId).tabIds[0]!;
    const moved = moveWorkspaceTab(workspace, {
      sourcePaneId: paneId,
      targetPaneId: paneId,
      tabId,
      targetIndex: 99,
    });
    expect(groupForPane(moved, paneId).tabIds.at(-1)).toBe(tabId);
  });

  it('ignores invalid panes and tabs', () => {
    const workspace = createWorkspace();
    expect(
      moveWorkspaceTab(workspace, {
        sourcePaneId: 'missing',
        targetPaneId: workspace.focusedPaneId!,
        tabId: workspace.focusedTabId!,
        targetIndex: 0,
      }),
    ).toBe(workspace);
    expect(
      moveWorkspaceTab(workspace, {
        sourcePaneId: workspace.focusedPaneId!,
        targetPaneId: workspace.focusedPaneId!,
        tabId: 'missing',
        targetIndex: 0,
      }),
    ).toBe(workspace);
  });
});

function groupForPane(workspace: Workspace, paneId: string) {
  const pane = findPane(workspace.layout!, paneId);
  if (!pane) throw new Error(`missing pane ${paneId}`);
  const group = workspace.tabGroups[pane.tabGroupId];
  if (!group) throw new Error(`missing group ${pane.tabGroupId}`);
  return group;
}
