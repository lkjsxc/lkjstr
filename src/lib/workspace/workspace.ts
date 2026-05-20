import {
  createLayout,
  findPane,
  paneIds,
  type SplitDirection,
  type WorkspaceLayoutNode,
} from './layout-tree';
import { createPane } from './pane';
import { titleFor } from './tab-title';
import {
  activateTab,
  addTab,
  createEmptyTabGroup,
  createTabGroup,
  type TabGroup,
} from './tab-group';
import { convertTab, createTab, type TabKind, type WorkspaceTab } from './tab';
import {
  closeTabAndRecover,
  ensureUsableWorkspace,
} from './workspace-recovery';
import { smartSplitPane } from './smart-split';

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
    sidebarVisible: false,
    activityBarVisible: false,
    updatedAt: Date.now(),
  };
}

export function openNewTabChooser(
  workspace: Workspace,
  paneId: string,
): Workspace {
  return openTab(workspace, paneId, 'new-tab', titleFor('new-tab'));
}

export function openTab(
  workspace: Workspace,
  paneId: string | null,
  kind: TabKind,
  title: string,
  config: Record<string, unknown> = {},
): Workspace {
  const withPane = ensureUsableWorkspace(workspace);
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
  kind: TabKind = 'new-tab',
): Workspace {
  const usable = ensureUsableWorkspace(workspace);
  if (!usable.layout || !usable.focusedPaneId) return usable;
  const tab = createTab(kind, titleFor(kind));
  const group = createTabGroup(tab);
  const pane = createPane(group.id);
  return touch({
    ...usable,
    layout: smartSplitPane(
      usable.layout,
      usable.focusedPaneId,
      direction,
      pane,
    ),
    tabGroups: { ...usable.tabGroups, [group.id]: group },
    tabs: { ...usable.tabs, [tab.id]: tab },
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

export function convertWorkspaceTab(
  workspace: Workspace,
  tabId: string,
  kind: TabKind,
  config: Record<string, unknown> = {},
): Workspace {
  const tab = workspace.tabs[tabId];
  if (!tab) return workspace;
  return touch({
    ...workspace,
    tabs: {
      ...workspace.tabs,
      [tabId]: convertTab(tab, kind, titleFor(kind), config),
    },
    focusedTabId: tabId,
  });
}

export function closeWorkspaceTab(
  workspace: Workspace,
  paneId: string,
  tabId: string,
): Workspace {
  return closeTabAndRecover(workspace, paneId, tabId);
}

export { titleFor } from './tab-title';
export {
  closePaneAndRecover,
  closeTabAndRecover,
  createRecoveryWorkspace,
  ensureUsableWorkspace,
} from './workspace-recovery';

function touch(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: Date.now() };
}
