import type { TabDropEdge } from './move-tab';

export type PointerDropZone = TabDropEdge | 'center';

export type PointerDragSnapshot = {
  readonly sourcePaneId: string;
  readonly tabId: string;
  readonly startX: number;
  readonly startY: number;
  readonly active: boolean;
};

export function startPointerTabDrag(
  sourcePaneId: string,
  tabId: string,
  startX: number,
  startY: number,
): PointerDragSnapshot {
  return { sourcePaneId, tabId, startX, startY, active: false };
}

export function activatePointerDrag(
  snapshot: PointerDragSnapshot,
  x: number,
  y: number,
  threshold = 6,
): PointerDragSnapshot {
  if (snapshot.active || distance(snapshot, x, y) < threshold) return snapshot;
  return { ...snapshot, active: true };
}

export function pointerDropZone(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): PointerDropZone {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const xLimit = edgeThreshold(rect.width);
  const yLimit = edgeThreshold(rect.height);
  if (x <= xLimit) return 'left';
  if (x >= rect.width - xLimit) return 'right';
  if (y <= yLimit) return 'top';
  if (y >= rect.height - yLimit) return 'bottom';
  return 'center';
}

export function pointerPaneAt(
  doc: Document,
  clientX: number,
  clientY: number,
): HTMLElement | undefined {
  return doc
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>('[data-pane-id]') ?? undefined;
}

function edgeThreshold(size: number): number {
  return Math.min(72, Math.max(32, size * 0.18));
}

function distance(
  snapshot: Pick<PointerDragSnapshot, 'startX' | 'startY'>,
  x: number,
  y: number,
): number {
  return Math.hypot(x - snapshot.startX, y - snapshot.startY);
}
