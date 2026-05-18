import { findPane, removePane } from './layout-tree';
import {
  insertMovedTab,
  moveTabWithinGroup,
  removeTabForMove,
} from './tab-group';
import type { Workspace } from './workspace';

export type MoveWorkspaceTabInput = {
  readonly sourcePaneId: string;
  readonly targetPaneId: string;
  readonly tabId: string;
  readonly targetIndex: number;
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

function touch(workspace: Workspace): Workspace {
  return { ...workspace, updatedAt: Date.now() };
}
