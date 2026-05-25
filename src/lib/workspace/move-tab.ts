import { findPane, removePane } from './layout-tree';
import { insertPaneBySplitIntent } from './insert-pane-split';
import { createPane } from './pane';
import {
  insertMovedTab,
  moveTabWithinGroup,
  removeTabForMove,
  type TabGroup,
} from './tab-group';
import type { Workspace } from './workspace';

export type TabDropEdge = 'left' | 'right' | 'top' | 'bottom';

export type MoveWorkspaceTabInput = {
  readonly sourcePaneId: string;
  readonly targetPaneId: string;
  readonly tabId: string;
  readonly targetIndex: number;
  readonly edge?: TabDropEdge;
};

export function moveWorkspaceTab(
  workspace: Workspace,
  input: MoveWorkspaceTabInput,
): Workspace {
  if (!workspace.layout) return workspace;
  const sourcePane = findPane(workspace.layout, input.sourcePaneId);
  const targetPane = findPane(workspace.layout, input.targetPaneId);
  const sourceGroup = sourcePane
    ? workspace.tabGroups[sourcePane.tabGroupId]
    : undefined;
  const targetGroup = targetPane
    ? workspace.tabGroups[targetPane.tabGroupId]
    : undefined;
  if (
    !sourcePane ||
    !targetPane ||
    !sourceGroup ||
    !targetGroup ||
    !workspace.tabs[input.tabId] ||
    !sourceGroup.tabIds.includes(input.tabId)
  )
    return workspace;

  if (input.edge)
    return moveWorkspaceTabToEdge(
      workspace,
      { ...input, edge: input.edge },
      sourceGroup,
      targetPane.id,
    );

  if (sourcePane.id === targetPane.id)
    return touch({
      ...workspace,
      focusedPaneId: targetPane.id,
      focusedTabId: input.tabId,
      tabGroups: {
        ...workspace.tabGroups,
        [sourceGroup.id]: {
          ...moveTabWithinGroup(sourceGroup, input.tabId, input.targetIndex),
          activeTabId: input.tabId,
        },
      },
    });

  const nextSourceGroup = removeTabForMove(sourceGroup, input.tabId);
  const nextTargetGroup = insertMovedTab(
    targetGroup,
    input.tabId,
    input.targetIndex,
  );
  const tabGroups = {
    ...workspace.tabGroups,
    [targetGroup.id]: nextTargetGroup,
  };
  let layout = workspace.layout;
  if (nextSourceGroup.tabIds.length === 0) {
    delete tabGroups[sourceGroup.id];
    layout = removePane(layout, sourcePane.id) ?? layout;
  } else {
    tabGroups[sourceGroup.id] = nextSourceGroup;
  }
  return touch({
    ...workspace,
    layout,
    tabGroups,
    focusedPaneId: targetPane.id,
    focusedTabId: input.tabId,
  });
}

function moveWorkspaceTabToEdge(
  workspace: Workspace,
  input: MoveWorkspaceTabInput & { edge: TabDropEdge },
  sourceGroup: TabGroup,
  targetPaneId: string,
): Workspace {
  if (!workspace.layout) return workspace;
  if (sourceGroup.tabIds.length <= 1 && input.sourcePaneId === targetPaneId)
    return workspace;
  const nextSourceGroup = removeTabForMove(sourceGroup, input.tabId);
  const newGroup = {
    id: crypto.randomUUID(),
    tabIds: [input.tabId],
    activeTabId: input.tabId,
    pinnedTabIds: [],
    closedTabs: [],
  };
  const newPane = createPane(newGroup.id);
  const tabGroups = { ...workspace.tabGroups, [newGroup.id]: newGroup };
  let layout = workspace.layout;
  if (nextSourceGroup.tabIds.length === 0) {
    delete tabGroups[sourceGroup.id];
    layout = removePane(layout, input.sourcePaneId) ?? layout;
  } else tabGroups[sourceGroup.id] = nextSourceGroup;
  layout = insertPaneBySplitIntent(layout, targetPaneId, input.edge, newPane);
  return touch({
    ...workspace,
    layout,
    tabGroups,
    focusedPaneId: newPane.id,
    focusedTabId: input.tabId,
  });
}

function touch(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: Date.now() };
}
