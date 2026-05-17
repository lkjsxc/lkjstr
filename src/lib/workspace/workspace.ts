import {
  createLayout,
  findPane,
  paneIds,
  splitPane,
  type SplitDirection,
  type WorkspaceLayoutNode,
} from './layout-tree';
import { createPane } from './pane';
import { titleFor } from './tab-title';
import {
  activateTab,
  addTab,
  closeTab,
  createEmptyTabGroup,
  createTabGroup,
  type TabGroup,
} from './tab-group';
import { createTab, type TabKind, type WorkspaceTab } from './tab';

export type Workspace = {
  readonly id: string;
  readonly name: string;
  readonly layout: WorkspaceLayoutNode | null;
  readonly tabGroups: Record<string, TabGroup>;
  readonly tabs: Record<string, WorkspaceTab>;
  readonly focusedPaneId: string | null;
  readonly focusedTabId: string | null;
  readonly activeAccountId: string | null;
  readonly sidebarVisible: boolean;
  readonly activityBarVisible: boolean;
  readonly updatedAt: number;
};

export function createWorkspace(): Workspace {
  const tab = createTab('timeline', 'Home', { variant: 'home' });
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
    sidebarVisible: true,
    activityBarVisible: true,
    updatedAt: Date.now(),
  };
}

export function createEmptyWorkspace(): Workspace {
  return {
    id: crypto.randomUUID(),
    name: 'Main workspace',
    layout: null,
    tabGroups: {},
    tabs: {},
    focusedPaneId: null,
    focusedTabId: null,
    activeAccountId: null,
    sidebarVisible: true,
    activityBarVisible: true,
    updatedAt: Date.now(),
  };
}

export function ensureWorkspaceHasPane(workspace: Workspace): Workspace {
  if (workspace.layout) return workspace;
  const group = createEmptyTabGroup();
  const layout = createLayout(group.id);
  return touch({
    ...workspace,
    layout,
    tabGroups: { ...workspace.tabGroups, [group.id]: group },
    focusedPaneId: layout.id,
    focusedTabId: null,
  });
}

export function openFirstPaneTab(
  workspace: Workspace,
  kind: TabKind,
): Workspace {
  const withPane = ensureWorkspaceHasPane(workspace);
  const paneId = withPane.focusedPaneId ?? paneIds(withPane.layout!)[0] ?? null;
  return openTab(withPane, paneId, kind, titleFor(kind));
}

export function openTab(
  workspace: Workspace,
  paneId: string | null,
  kind: TabKind,
  title: string,
  config: Record<string, unknown> = {},
): Workspace {
  const withPane = ensureWorkspaceHasPane(workspace);
  if (!withPane.layout) return withPane;
  const targetPaneId =
    paneId ?? withPane.focusedPaneId ?? paneIds(withPane.layout)[0] ?? null;
  if (!targetPaneId) return withPane;
  const pane = findPane(withPane.layout, targetPaneId);
  if (!pane) return workspace;
  const tab = createTab(kind, title, config);
  const group =
    withPane.tabGroups[pane.tabGroupId] ??
    ({ ...createEmptyTabGroup(), id: pane.tabGroupId } satisfies TabGroup);
  return touch({
    ...withPane,
    tabs: { ...withPane.tabs, [tab.id]: tab },
    tabGroups: {
      ...withPane.tabGroups,
      [group.id]: addTab(group, tab.id),
    },
    focusedPaneId: pane.id,
    focusedTabId: tab.id,
  });
}

export function splitFocusedPane(
  workspace: Workspace,
  direction: SplitDirection,
  kind: TabKind = 'timeline',
): Workspace {
  if (!workspace.layout || !workspace.focusedPaneId) return workspace;
  const tab = createTab(kind, titleFor(kind));
  const group = createTabGroup(tab);
  const pane = createPane(group.id);
  return touch({
    ...workspace,
    layout: splitPane(
      workspace.layout,
      workspace.focusedPaneId,
      direction,
      pane,
    ),
    tabGroups: { ...workspace.tabGroups, [group.id]: group },
    tabs: { ...workspace.tabs, [tab.id]: tab },
    focusedPaneId: pane.id,
    focusedTabId: tab.id,
  });
}

export function focusTab(
  workspace: Workspace,
  paneId: string,
  tabId: string,
): Workspace {
  if (!workspace.layout) return workspace;
  const pane = findPane(workspace.layout, paneId);
  const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
  if (!pane || !group || !group.tabIds.includes(tabId)) return workspace;
  return touch({
    ...workspace,
    focusedPaneId: paneId,
    focusedTabId: tabId,
    tabGroups: {
      ...workspace.tabGroups,
      [group.id]: activateTab(group, tabId),
    },
  });
}

export function closeWorkspaceTab(
  workspace: Workspace,
  paneId: string,
  tabId: string,
): Workspace {
  if (!workspace.layout) return workspace;
  const pane = findPane(workspace.layout, paneId);
  const group = pane ? workspace.tabGroups[pane.tabGroupId] : undefined;
  const tab = workspace.tabs[tabId];
  if (!pane || !group || !tab) return workspace;
  const nextGroup = closeTab(group, tab);
  const tabs = { ...workspace.tabs };
  delete tabs[tabId];
  if (nextGroup.tabIds.length > 0) {
    return touch({
      ...workspace,
      tabs,
      tabGroups: { ...workspace.tabGroups, [group.id]: nextGroup },
      focusedTabId: nextGroup.activeTabId,
    });
  }
  return touch({
    ...workspace,
    tabGroups: { ...workspace.tabGroups, [group.id]: nextGroup },
    tabs,
    focusedPaneId: pane.id,
    focusedTabId: null,
  });
}

export { titleFor } from './tab-title';

function touch(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: Date.now() };
}
