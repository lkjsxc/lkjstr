export type TabStateRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly tabId: string;
  readonly lastPaneId?: string;
  readonly state: unknown;
  readonly updatedAt: number;
};
