import type { WorkspaceLayoutNode } from './layout-tree';
import type { WorkspaceTab } from './tab';
import type { TabSnapshotCoordinator } from './tab-snapshot-coordinator';
import type { Workspace } from './workspace';

type TabPlacement = {
  readonly paneId: string;
  readonly tab: WorkspaceTab;
};

export async function captureWorkspaceSnapshots(
  coordinator: TabSnapshotCoordinator,
  workspace: Workspace,
): Promise<void> {
  await Promise.all(
    tabPlacements(workspace).map(({ paneId, tab }) =>
      coordinator.captureTab(paneId, tab),
    ),
  );
}

export async function cleanupWorkspaceSnapshots(
  coordinator: TabSnapshotCoordinator,
  workspace: Workspace,
): Promise<void> {
  await coordinator.cleanup(new Set(Object.keys(workspace.tabs)));
}

export function tabPlacements(workspace: Workspace): TabPlacement[] {
  const placements: TabPlacement[] = [];
  visitPane(workspace.layout, (paneId, tabGroupId) => {
    const group = workspace.tabGroups[tabGroupId];
    if (!group) return;
    for (const tabId of group.tabIds) {
      const tab = workspace.tabs[tabId];
      if (tab) placements.push({ paneId, tab });
    }
  });
  return placements;
}

function visitPane(
  node: WorkspaceLayoutNode | null,
  visit: (paneId: string, tabGroupId: string) => void,
): void {
  if (!node) return;
  if (node.type === 'pane') {
    visit(node.id, node.tabGroupId);
    return;
  }
  for (const child of node.children) visitPane(child, visit);
}
