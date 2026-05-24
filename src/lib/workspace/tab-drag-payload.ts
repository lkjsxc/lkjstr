export type DraggedTab = {
  readonly sourcePaneId: string;
  readonly tabId: string;
};

export const tabDragMime = 'application/x-lkjstr-tab';

export function tabDragPayload(sourcePaneId: string, tabId: string): string {
  return JSON.stringify({ sourcePaneId, tabId });
}

export function dragHasTabPayload(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes(tabDragMime);
}

export function readDraggedTab(event: DragEvent): DraggedTab | undefined {
  const raw = event.dataTransfer?.getData(tabDragMime);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<DraggedTab>;
    if (typeof value.sourcePaneId !== 'string') return undefined;
    if (typeof value.tabId !== 'string') return undefined;
    return { sourcePaneId: value.sourcePaneId, tabId: value.tabId };
  } catch {
    return undefined;
  }
}
