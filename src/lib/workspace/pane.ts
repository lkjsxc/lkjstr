export type WorkspacePaneNode = {
  readonly id: string;
  readonly type: 'pane';
  readonly tabGroupId: string;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly collapsed?: boolean;
};

export function createPane(tabGroupId: string): WorkspacePaneNode {
  return {
    id: crypto.randomUUID(),
    type: 'pane',
    tabGroupId,
    minWidth: 260,
    minHeight: 180,
  };
}

export function isPaneNode(value: unknown): value is WorkspacePaneNode {
  const item = value as Partial<WorkspacePaneNode>;
  return (
    typeof item === 'object' &&
    item !== null &&
    item.type === 'pane' &&
    typeof item.id === 'string' &&
    typeof item.tabGroupId === 'string' &&
    typeof item.minWidth === 'number' &&
    typeof item.minHeight === 'number'
  );
}
