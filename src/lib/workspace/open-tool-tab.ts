import { findPane } from './layout-tree';
import { titleFor } from './tab-title';
import { focusTab, openTab, type Workspace } from './workspace';
import type { TabKind } from './tab';

export function openToolTab(
  workspace: Workspace,
  paneId: string,
  kind: TabKind,
): Workspace {
  const existing = existingTabInPane(workspace, paneId, kind);
  if (existing) return focusTab(workspace, paneId, existing);
  return openTab(workspace, paneId, kind, titleFor(kind));
}

function existingTabInPane(
  workspace: Workspace,
  paneId: string,
  kind: TabKind,
): string | undefined {
  if (!workspace.layout) return undefined;
  const pane = findPane(workspace.layout, paneId);
  const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
  return group?.tabIds.find((id) => workspace.tabs[id]?.kind === kind);
}
