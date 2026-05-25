import type { SplitDirection } from './layout-tree';
import { smartSplitPane } from './smart-split';
import type { TabDropEdge } from './move-tab';
import type { WorkspaceLayoutNode } from './layout-tree';
import type { WorkspacePaneNode } from './pane';

export function insertPaneBySplitIntent(
  layout: WorkspaceLayoutNode,
  targetPaneId: string,
  edge: TabDropEdge,
  newPane: WorkspacePaneNode,
): WorkspaceLayoutNode {
  return smartSplitPane(
    layout,
    targetPaneId,
    edgeDirection(edge),
    newPane,
    edgeSide(edge),
  );
}

function edgeDirection(edge: TabDropEdge): SplitDirection {
  return edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
}

function edgeSide(edge: TabDropEdge): 'before' | 'after' {
  return edge === 'left' || edge === 'top' ? 'before' : 'after';
}
