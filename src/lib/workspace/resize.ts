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

export function pointerDeltaToSplitRatio(
  deltaPx: number,
  containerSizePx: number,
  sensitivity = 0.45,
): number {
  if (Math.abs(deltaPx) < 2) return 0;
  return (deltaPx / Math.max(containerSizePx, 240)) * sensitivity;
}

export function resizeHere(
  split: WorkspaceSplitNode,
  handleIndex: number,
  deltaRatio: number,
): WorkspaceSplitNode {
  if (handleIndex < 0 || handleIndex >= split.sizes.length - 1) return split;
  const sizes = [...split.sizes];
  const min = 0.08;
  const left = sizes[handleIndex] ?? 1 / split.children.length;
  const right = sizes[handleIndex + 1] ?? 1 / split.children.length;
  const pair = left + right;
  const nextLeft = Math.min(pair - min, Math.max(min, left + deltaRatio));
  sizes[handleIndex] = nextLeft;
  sizes[handleIndex + 1] = pair - nextLeft;
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

export function setSplitRatios(
  node: WorkspaceLayoutNode,
  splitId: string,
  ratios: readonly number[],
): WorkspaceLayoutNode {
  if (node.type === 'pane') return node;
  if (node.id !== splitId) {
    return {
      ...node,
      children: node.children.map((child) =>
        setSplitRatios(child, splitId, ratios),
      ),
    };
  }
  return { ...node, sizes: normalizeRatios(ratios, node.children.length) };
}
