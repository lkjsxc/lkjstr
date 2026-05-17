import {
  createSplit,
  equalSizes,
  findPane,
  type SplitDirection,
  type WorkspaceLayoutNode,
} from './layout-tree';
import { createPane, type WorkspacePaneNode } from './pane';
import { setSplitRatios as setRatios } from './resize';
import { createTab, type TabKind, type WorkspaceTab } from './tab';
import { titleFor } from './tab-title';
import {
  createEmptyTabGroup,
  createTabGroup,
  type TabGroup,
} from './tab-group';
import type { Workspace } from './workspace';

type CreatedPane = {
  readonly pane: WorkspacePaneNode;
  readonly group: TabGroup;
  readonly tab?: WorkspaceTab;
};

export function splitPaneInto(
  workspace: Workspace,
  paneId: string,
  direction: SplitDirection,
  count: number,
  tabKind?: TabKind,
): Workspace {
  if (!workspace.layout || count < 2 || count > 12) return workspace;
  const pane = findPane(workspace.layout, paneId);
  if (!pane) return workspace;
  const created = Array.from({ length: count - 1 }, () => makePane(tabKind));
  const children = [pane, ...created.map((item) => item.pane)];
  return withCreated(workspace, {
    layout: replacePane(
      workspace.layout,
      paneId,
      createSplit(direction, children),
    ),
    created,
  });
}

export function insertPaneIntoSplit(
  workspace: Workspace,
  splitId: string,
  index: number,
  tabKind?: TabKind,
): Workspace {
  if (!workspace.layout) return workspace;
  const created = makePane(tabKind);
  return withCreated(workspace, {
    layout: insertIntoSplit(workspace.layout, splitId, index, created.pane),
    created: [created],
  });
}

export function distributeSplitEvenly(
  layout: WorkspaceLayoutNode,
  splitId: string,
): WorkspaceLayoutNode {
  return setRatios(layout, splitId, []);
}

export function setSplitRatios(
  layout: WorkspaceLayoutNode,
  splitId: string,
  ratios: number[],
): WorkspaceLayoutNode {
  return setRatios(layout, splitId, ratios);
}

function makePane(tabKind?: TabKind): CreatedPane {
  if (!tabKind) {
    const group = createEmptyTabGroup();
    return { pane: createPane(group.id), group };
  }
  const tab = createTab(tabKind, titleFor(tabKind));
  const group = createTabGroup(tab);
  return { pane: createPane(group.id), group, tab };
}

function withCreated(
  workspace: Workspace,
  next: { layout: WorkspaceLayoutNode; created: readonly CreatedPane[] },
): Workspace {
  const tabGroups = { ...workspace.tabGroups };
  const tabs = { ...workspace.tabs };
  for (const item of next.created) {
    tabGroups[item.group.id] = item.group;
    if (item.tab) tabs[item.tab.id] = item.tab;
  }
  const focused = next.created.at(0);
  return {
    ...workspace,
    layout: next.layout,
    tabGroups,
    tabs,
    focusedPaneId: focused?.pane.id ?? workspace.focusedPaneId,
    focusedTabId: focused?.tab?.id ?? workspace.focusedTabId,
    updatedAt: Date.now(),
  };
}

function replacePane(
  node: WorkspaceLayoutNode,
  paneId: string,
  replacement: WorkspaceLayoutNode,
): WorkspaceLayoutNode {
  if (node.type === 'pane') return node.id === paneId ? replacement : node;
  return {
    ...node,
    children: node.children.map((child) =>
      replacePane(child, paneId, replacement),
    ),
  };
}

function insertIntoSplit(
  node: WorkspaceLayoutNode,
  splitId: string,
  index: number,
  pane: WorkspacePaneNode,
): WorkspaceLayoutNode {
  if (node.type === 'pane') return node;
  if (node.id !== splitId) {
    return {
      ...node,
      children: node.children.map((child) =>
        insertIntoSplit(child, splitId, index, pane),
      ),
    };
  }
  const children = [...node.children];
  children.splice(Math.max(0, Math.min(index, children.length)), 0, pane);
  return { ...node, children, sizes: equalSizes(children.length) };
}
