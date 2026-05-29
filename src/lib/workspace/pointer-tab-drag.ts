import { paneChromeRects, resolvePaneDrop } from './pane-drop-resolve';
import type { TabDropZone } from './tab-drop-hit';

export type PointerDragSnapshot = {
  readonly sourcePaneId: string;
  readonly tabId: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly x: number;
  readonly y: number;
  readonly active: boolean;
  readonly targetPaneId?: string;
  readonly targetIndex?: number;
  readonly zone?: TabDropZone;
};

export type TabInsertionFrame = {
  readonly tabId: string;
  readonly left: number;
  readonly width: number;
};

export function startPointerTabDrag(
  sourcePaneId: string,
  tabId: string,
  pointerId: number,
  startX: number,
  startY: number,
): PointerDragSnapshot {
  return {
    sourcePaneId,
    tabId,
    pointerId,
    startX,
    startY,
    x: startX,
    y: startY,
    active: false,
  };
}

export function activatePointerDrag(
  snapshot: PointerDragSnapshot,
  x: number,
  y: number,
  threshold = 6,
): PointerDragSnapshot {
  const active = snapshot.active || distance(snapshot, x, y) >= threshold;
  return { ...snapshot, x, y, active };
}

export function pointerPaneAt(
  doc: Document,
  clientX: number,
  clientY: number,
): HTMLElement | undefined {
  return (
    doc
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-pane-id]') ?? undefined
  );
}

export function pointerDragTarget(
  doc: Document,
  snapshot: PointerDragSnapshot,
): PointerDragSnapshot {
  const target = pointerPaneAt(doc, snapshot.x, snapshot.y);
  const targetPaneId = target?.dataset.paneId;
  if (!target || !targetPaneId)
    return {
      ...snapshot,
      targetPaneId: undefined,
      targetIndex: undefined,
      zone: undefined,
    };
  const { paneRect, bodyRect, chromeBottom, stripBottom } =
    paneChromeRects(target);
  const resolved = resolvePaneDrop({
    paneRect,
    bodyRect,
    chromeBottom,
    stripBottom,
    clientX: snapshot.x,
    clientY: snapshot.y,
    sourcePaneId: snapshot.sourcePaneId,
    targetPaneId,
    draggedTabId: snapshot.tabId,
    frames: tabFrames(doc, targetPaneId),
  });
  return {
    ...snapshot,
    targetPaneId,
    targetIndex: resolved.targetIndex,
    zone: resolved.zone,
  };
}

export function tabInsertionIndex(
  frames: readonly TabInsertionFrame[],
  clientX: number,
  draggedTabId?: string,
): number {
  const candidates = frames.filter((frame) => frame.tabId !== draggedTabId);
  const target = candidates.findIndex(
    (frame) => clientX < frame.left + frame.width / 2,
  );
  return target === -1 ? candidates.length : target;
}

function tabFrames(doc: Document, targetPaneId: string): TabInsertionFrame[] {
  return [
    ...doc.querySelectorAll<HTMLElement>(
      `[data-pane-id="${cssEscape(targetPaneId)}"] .tab-frame[data-tab-id]`,
    ),
  ].map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      tabId: element.dataset.tabId ?? '',
      left: rect.left,
      width: rect.width,
    };
  });
}

function cssEscape(value: string): string {
  return 'CSS' in globalThis && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&');
}

function distance(
  snapshot: Pick<PointerDragSnapshot, 'startX' | 'startY'>,
  x: number,
  y: number,
): number {
  return Math.hypot(x - snapshot.startX, y - snapshot.startY);
}
