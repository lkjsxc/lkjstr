import {
  createSplit,
  equalSizes,
  type SplitDirection,
  type WorkspaceLayoutNode,
  type WorkspaceSplitNode,
} from './layout-tree';
import type { WorkspacePaneNode } from './pane';

export function smartSplitPane(
  root: WorkspaceLayoutNode,
  paneId: string,
  direction: SplitDirection,
  newPane: WorkspacePaneNode,
  side: 'before' | 'after' = 'after',
): WorkspaceLayoutNode {
  const target = findPath(root, paneId);
  if (!target) return root;
  const parent = target.path.at(-1);
  if (!parent) {
    const children = side === 'before' ? [newPane, root] : [root, newPane];
    return createSplit(direction, children);
  }
  if (parent.split.direction === direction)
    return replaceSplit(
      root,
      parent.split.id,
      insertPaneNearTarget(parent.split, paneId, newPane, side),
    );
  const children =
    side === 'before' ? [newPane, target.pane] : [target.pane, newPane];
  return replacePane(root, paneId, createSplit(direction, children));
}

export function insertPaneNearTarget(
  split: WorkspaceSplitNode,
  targetPaneId: string,
  newPane: WorkspacePaneNode,
  side: 'before' | 'after',
): WorkspaceSplitNode {
  const index = split.children.findIndex((child) =>
    containsPane(child, targetPaneId),
  );
  if (index < 0) return split;
  const children = [...split.children];
  children.splice(side === 'before' ? index : index + 1, 0, newPane);
  return { ...split, children, sizes: equalSizes(children.length) };
}

function replaceSplit(
  node: WorkspaceLayoutNode,
  splitId: string,
  replacement: WorkspaceSplitNode,
): WorkspaceLayoutNode {
  if (node.type === 'pane') return node;
  if (node.id === splitId) return replacement;
  return {
    ...node,
    children: node.children.map((child) =>
      replaceSplit(child, splitId, replacement),
    ),
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

function containsPane(node: WorkspaceLayoutNode, paneId: string): boolean {
  if (node.type === 'pane') return node.id === paneId;
  return node.children.some((child) => containsPane(child, paneId));
}

function findPath(
  node: WorkspaceLayoutNode,
  paneId: string,
  path: { split: WorkspaceSplitNode; index: number }[] = [],
):
  | {
      pane: WorkspacePaneNode;
      path: { split: WorkspaceSplitNode; index: number }[];
    }
  | undefined {
  if (node.type === 'pane')
    return node.id === paneId ? { pane: node, path } : undefined;
  for (const [index, child] of node.children.entries()) {
    const found = findPath(child, paneId, [...path, { split: node, index }]);
    if (found) return found;
  }
  return undefined;
}
