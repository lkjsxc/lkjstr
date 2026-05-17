import type { WorkspaceLayoutNode } from './layout-tree';

export type RectSize = {
  readonly width: number;
  readonly height: number;
};

export function minimumSize(node: WorkspaceLayoutNode): RectSize {
  if (node.type === 'pane') {
    return { width: node.minWidth, height: node.minHeight };
  }
  const sizes = node.children.map(minimumSize);
  if (node.direction === 'horizontal') {
    return {
      width: sizes.reduce((sum, size) => sum + size.width, 0),
      height: Math.max(...sizes.map((size) => size.height)),
    };
  }
  return {
    width: Math.max(...sizes.map((size) => size.width)),
    height: sizes.reduce((sum, size) => sum + size.height, 0),
  };
}

export function normalizeRatios(
  sizes: readonly number[],
  expectedCount = sizes.length,
): number[] {
  const clean = sizes.map((size) =>
    Number.isFinite(size) && size > 0 ? size : 1,
  );
  while (clean.length < expectedCount) clean.push(1);
  if (clean.length > expectedCount) clean.length = expectedCount;
  const total = clean.reduce((sum, size) => sum + size, 0);
  return clean.map((size) => size / total);
}
