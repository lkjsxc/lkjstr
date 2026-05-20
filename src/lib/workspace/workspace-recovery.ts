import { createLayout, findPane, paneIds, removePane } from './layout-tree';
import { createTab, type WorkspaceTab } from './tab';
import { titleFor } from './tab-title';
import { closeTab, createTabGroup, type TabGroup } from './tab-group';
import type { Workspace } from './workspace';

export function createRecoveryWorkspace(): Workspace {
  const tab = createTab('welcome', titleFor('welcome'));
  const group = createTabGroup(tab);
  const layout = createLayout(group.id);
  return {
    id: crypto.randomUUID(),
    name: 'Main workspace',
    layout,
    tabGroups: { [group.id]: group },
    tabs: { [tab.id]: tab },
    focusedPaneId: layout.id,
    focusedTabId: tab.id,
    activeAccountId: null,
    sidebarVisible: false,
    activityBarVisible: false,
    updatedAt: Date.now(),
  };
}

export function ensureUsableWorkspace(workspace: Workspace): Workspace {
  const recovery = (): Workspace =>
    touch({
      ...createRecoveryWorkspace(),
      id: workspace.id,
      name: workspace.name,
      activeAccountId: workspace.activeAccountId,
      sidebarVisible: false,
      activityBarVisible: false,
    });
  if (!workspace.layout) return recovery();
  const ids = paneIds(workspace.layout);
  if (ids.length === 0) return recovery();
  const normalized = normalizePaneRecords(workspace, ids);
  if (!normalized) return recovery();
  const focusedPaneId = focusedPane(workspace, ids);
  const focusedTabId = focusedTab(workspace, normalized, focusedPaneId);
  return {
    ...workspace,
    tabs: normalized.tabs,
    tabGroups: normalized.tabGroups,
    focusedPaneId,
    focusedTabId,
  };
}

export function closePaneAndRecover(
  workspace: Workspace,
  paneId: string,
): Workspace {
  if (!workspace.layout) return ensureUsableWorkspace(workspace);
  const pane = findPane(workspace.layout, paneId);
  const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
  if (!pane || !group) return ensureUsableWorkspace(workspace);
  const tabs = { ...workspace.tabs };
  for (const id of group.tabIds) delete tabs[id];
  const tabGroups = { ...workspace.tabGroups };
  delete tabGroups[group.id];
  return ensureUsableWorkspace(
    touch({
      ...workspace,
      layout: removePane(workspace.layout, paneId) ?? null,
      tabGroups,
      tabs,
      focusedPaneId: null,
      focusedTabId: null,
    }),
  );
}

export function closeTabAndRecover(
  workspace: Workspace,
  paneId: string,
  tabId: string,
): Workspace {
  if (!workspace.layout) return ensureUsableWorkspace(workspace);
  const pane = findPane(workspace.layout, paneId);
  const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
  const tab = workspace.tabs[tabId];
  if (!pane || !group || !tab) return ensureUsableWorkspace(workspace);
  const nextGroup = closeTab(group, tab);
  const tabs = { ...workspace.tabs };
  delete tabs[tabId];
  if (nextGroup.tabIds.length > 0)
    return ensureUsableWorkspace(
      touch({
        ...workspace,
        tabs,
        tabGroups: { ...workspace.tabGroups, [group.id]: nextGroup },
        focusedPaneId: pane.id,
        focusedTabId: nextGroup.activeTabId,
      }),
    );
  return closePaneAndRecover({ ...workspace, tabs }, pane.id);
}

function normalizePaneRecords(
  workspace: Workspace,
  ids: readonly string[],
):
  | { tabs: Record<string, WorkspaceTab>; tabGroups: Record<string, TabGroup> }
  | undefined {
  const tabs: Record<string, WorkspaceTab> = {};
  const tabGroups: Record<string, TabGroup> = {};
  for (const paneId of ids) {
    const pane = workspace.layout
      ? findPane(workspace.layout, paneId)
      : undefined;
    const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
    const tabIds = group?.tabIds.filter((id) => workspace.tabs[id]) ?? [];
    if (!pane || !group || tabIds.length === 0) return undefined;
    tabIds.forEach((id) => (tabs[id] = workspace.tabs[id]!));
    tabGroups[group.id] = {
      ...group,
      tabIds,
      activeTabId:
        group.activeTabId && tabIds.includes(group.activeTabId)
          ? group.activeTabId
          : tabIds[0]!,
    };
  }
  return { tabs, tabGroups };
}

function focusedPane(workspace: Workspace, ids: readonly string[]): string {
  return workspace.focusedPaneId &&
    workspace.layout &&
    findPane(workspace.layout, workspace.focusedPaneId)
    ? workspace.focusedPaneId
    : ids[0]!;
}

function focusedTab(
  workspace: Workspace,
  normalized: {
    tabs: Record<string, WorkspaceTab>;
    tabGroups: Record<string, TabGroup>;
  },
  focusedPaneId: string,
): string {
  const pane = workspace.layout
    ? findPane(workspace.layout, focusedPaneId)
    : undefined;
  const group = pane ? normalized.tabGroups[pane.tabGroupId] : undefined;
  if (workspace.focusedTabId && normalized.tabs[workspace.focusedTabId])
    return workspace.focusedTabId;
  return group?.activeTabId ?? Object.keys(normalized.tabs)[0]!;
}

function touch(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: Date.now() };
}
