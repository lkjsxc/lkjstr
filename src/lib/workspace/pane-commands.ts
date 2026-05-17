import { findPane, paneIds, removePane } from './layout-tree';
import type { Workspace } from './workspace';

export function closeWorkspacePane(
  workspace: Workspace,
  paneId: string,
): Workspace {
  if (!workspace.layout) return workspace;
  const pane = findPane(workspace.layout, paneId);
  if (!pane) return workspace;
  const group = workspace.tabGroups[pane.tabGroupId];
  const tabs = { ...workspace.tabs };
  for (const tabId of group?.tabIds ?? []) delete tabs[tabId];
  const tabGroups = { ...workspace.tabGroups };
  delete tabGroups[pane.tabGroupId];
  const layout = removePane(workspace.layout, paneId) ?? null;
  const focusedPaneId = layout ? (paneIds(layout)[0] ?? null) : null;
  const nextPane =
    focusedPaneId && layout ? findPane(layout, focusedPaneId) : undefined;
  const focusedTabId = nextPane
    ? (tabGroups[nextPane.tabGroupId]?.activeTabId ?? null)
    : null;
  return {
    ...workspace,
    layout,
    tabGroups,
    tabs,
    focusedPaneId,
    focusedTabId,
    updatedAt: Date.now(),
  };
}
