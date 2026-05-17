import { createPane, isPaneNode, type WorkspacePaneNode } from './pane';

export type SplitDirection = 'horizontal' | 'vertical';

export type WorkspaceSplitNode = {
  readonly id: string;
  readonly type: 'split';
  readonly direction: SplitDirection;
  readonly children: readonly WorkspaceLayoutNode[];
  readonly sizes: readonly number[];
};

export type WorkspaceLayoutNode = WorkspaceSplitNode | WorkspacePaneNode;

export function createLayout(tabGroupId: string): WorkspacePaneNode {
  return createPane(tabGroupId);
}

export function createSplit(
  direction: SplitDirection,
  children: readonly WorkspaceLayoutNode[],
): WorkspaceSplitNode {
  return {
    id: crypto.randomUUID(),
    type: 'split',
    direction,
    children,
    sizes: equalSizes(children.length),
  };
}

export function splitPane(
  root: WorkspaceLayoutNode,
  paneId: string,
  direction: SplitDirection,
  newPane: WorkspacePaneNode,
  side: 'before' | 'after' = 'after',
): WorkspaceLayoutNode {
  if (root.type === 'pane') {
    if (root.id !== paneId) return root;
    const children = side === 'before' ? [newPane, root] : [root, newPane];
    return createSplit(direction, children);
  }
  return {
    ...root,
    children: root.children.map((child) =>
      splitPane(child, paneId, direction, newPane, side),
    ),
  };
}

export function removePane(
  root: WorkspaceLayoutNode,
  paneId: string,
): WorkspaceLayoutNode | undefined {
  if (root.type === 'pane') return root.id === paneId ? undefined : root;
  const children = root.children
    .map((child) => removePane(child, paneId))
    .filter((child): child is WorkspaceLayoutNode => Boolean(child));
  if (children.length === 0) return undefined;
  if (children.length === 1) return children[0];
  return { ...root, children, sizes: equalSizes(children.length) };
}

export function paneIds(root: WorkspaceLayoutNode): string[] {
  if (root.type === 'pane') return [root.id];
  return root.children.flatMap(paneIds);
}

export function findPane(
  root: WorkspaceLayoutNode,
  paneId: string,
): WorkspacePaneNode | undefined {
  if (root.type === 'pane') return root.id === paneId ? root : undefined;
  for (const child of root.children) {
    const pane = findPane(child, paneId);
    if (pane) return pane;
  }
  return undefined;
}

export function parseLayout(value: unknown): WorkspaceLayoutNode | undefined {
  if (isPaneNode(value)) return value;
  const item = value as Partial<WorkspaceSplitNode>;
  if (
    typeof item !== 'object' ||
    item === null ||
    item.type !== 'split' ||
    typeof item.id !== 'string' ||
    (item.direction !== 'horizontal' && item.direction !== 'vertical') ||
    !Array.isArray(item.children)
  )
    return undefined;
  const children = item.children.map(parseLayout);
  if (children.some((child) => !child)) return undefined;
  const nodes = children as WorkspaceLayoutNode[];
  if (nodes.length < 2) return undefined;
  const sizes = Array.isArray(item.sizes)
    ? item.sizes
    : equalSizes(nodes.length);
  if (sizes.length !== nodes.length || sizes.some((size) => size <= 0))
    return undefined;
  return {
    id: item.id,
    type: 'split',
    direction: item.direction,
    children: nodes,
    sizes,
  };
}

export function equalSizes(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}
