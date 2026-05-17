import {
  createLayout,
  findPane,
  paneIds,
  removePane,
  splitPane,
  type SplitDirection,
  type WorkspaceLayoutNode,
} from './layout-tree';
import { createPane } from './pane';
import {
  activateTab,
  addTab,
  closeTab,
  createTabGroup,
  type TabGroup,
} from './tab-group';
import { createTab, type TabKind, type WorkspaceTab } from './tab';

export type Workspace = {
  readonly id: string;
  readonly name: string;
  readonly layout: WorkspaceLayoutNode;
  readonly tabGroups: Record<string, TabGroup>;
  readonly tabs: Record<string, WorkspaceTab>;
  readonly focusedPaneId: string;
  readonly focusedTabId: string;
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

export function openTab(
  workspace: Workspace,
  paneId: string,
  kind: TabKind,
  title: string,
  config: Record<string, unknown> = {},
): Workspace {
  const pane = findPane(workspace.layout, paneId);
  if (!pane) return workspace;
  const tab = createTab(kind, title, config);
  const group = workspace.tabGroups[pane.tabGroupId];
  if (!group) return workspace;
  return touch({
    ...workspace,
    tabs: { ...workspace.tabs, [tab.id]: tab },
    tabGroups: {
      ...workspace.tabGroups,
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
  const layout = removePane(workspace.layout, paneId) ?? workspace.layout;
  const groups = { ...workspace.tabGroups };
  delete groups[group.id];
  const nextPane = paneIds(layout)[0] ?? paneId;
  return touch({
    ...workspace,
    layout,
    tabGroups: groups,
    tabs,
    focusedPaneId: nextPane,
  });
}

export function titleFor(kind: TabKind): string {
  const titles: Record<TabKind, string> = {
    timeline: 'Home',
    notifications: 'Notifications',
    profile: 'Profile',
    'account-manager': 'Accounts',
    'post-manager': 'Posts',
    thread: 'Thread',
    'relay-monitor': 'Relays',
    composer: 'Compose',
    settings: 'Settings',
    'cache-status': 'Cache',
  };
  return titles[kind];
}

function touch(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: Date.now() };
}
