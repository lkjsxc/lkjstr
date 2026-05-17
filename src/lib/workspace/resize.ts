import type { WorkspaceLayoutNode, WorkspaceSplitNode } from './layout-tree';
import { normalizeRatios } from './size-constraints';

export function resizeSplit(
  node: WorkspaceLayoutNode,
  splitId: string,
  handleIndex: number,
  deltaRatio: number,
): WorkspaceLayoutNode {
  if (node.type === 'pane') return node;
  if (node.id !== splitId) {
    return {
      ...node,
      children: node.children.map((child) =>
        resizeSplit(child, splitId, handleIndex, deltaRatio),
      ),
    };
  }
  return resizeHere(node, handleIndex, deltaRatio);
}

export function resizeHere(
  split: WorkspaceSplitNode,
  handleIndex: number,
  deltaRatio: number,
): WorkspaceSplitNode {
  if (handleIndex < 0 || handleIndex >= split.sizes.length - 1) return split;
  const sizes = [...split.sizes];
  const min = 0.08;
  const left = Math.max(min, sizes[handleIndex] + deltaRatio);
  const right = Math.max(min, sizes[handleIndex + 1] - deltaRatio);
  sizes[handleIndex] = left;
  sizes[handleIndex + 1] = right;
  return { ...split, sizes: normalizeRatios(sizes) };
}

export function equalizeSplit(
  node: WorkspaceLayoutNode,
  splitId: string,
): WorkspaceLayoutNode {
  if (node.type === 'pane') return node;
  if (node.id !== splitId) {
    return {
      ...node,
      children: node.children.map((child) => equalizeSplit(child, splitId)),
    };
  }
  return {
    ...node,
    sizes: node.children.map(() => 1 / node.children.length),
  };
}
