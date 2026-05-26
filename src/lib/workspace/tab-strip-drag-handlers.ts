import { tabDropEdge } from './tab-drop-zone';
import {
  clearStripTimer,
  moveStripPointer,
  startStripPointer,
  type StripPointerSession,
} from './tab-strip-pointer';
import type { TabDragState } from './tab-drag-state';

export type StripDragCtx = {
  session?: StripPointerSession;
  ghost?: { readonly x: number; readonly y: number; readonly title: string };
  dragElement?: HTMLElement;
  unbindWindow?: () => void;
};

export type StripDragDeps = {
  readonly paneId: string;
  readonly tabCount: () => number;
  readonly moveTab: (
    sourcePaneId: string,
    targetPaneId: string,
    tabId: string,
    targetIndex: number,
    edge?: 'left' | 'right' | 'top' | 'bottom',
  ) => void;
  readonly dragState?: TabDragState;
};

export function stripDragPointerDown(
  ctx: StripDragCtx,
  deps: StripDragDeps,
  event: PointerEvent,
  tabId: string,
  title: string,
): void {
  if (event.button !== 0) return;
  ctx.dragElement = event.currentTarget as HTMLElement;
  ctx.session = startStripPointer(deps.paneId, tabId, event);
  ctx.ghost = { x: event.clientX, y: event.clientY, title };
  if (typeof window === 'undefined') return;
  const move = (e: PointerEvent) => stripDragPointerMove(ctx, deps, e);
  const up = (e: PointerEvent) => stripDragPointerUp(ctx, deps, e);
  const cancel = (e: PointerEvent) => stripDragPointerCancel(ctx, deps, e);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  ctx.unbindWindow = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
  };
}

export function stripDragPointerMove(
  ctx: StripDragCtx,
  deps: StripDragDeps,
  event: PointerEvent,
): void {
  if (!ctx.session || event.pointerId !== ctx.session.snapshot.pointerId)
    return;
  const wasActive = ctx.session.snapshot.active;
  ctx.session = moveStripPointer(ctx.session, event);
  if (!ctx.session.snapshot.active) return;
  if (!wasActive) {
    try {
      ctx.dragElement?.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom and some test hosts omit capture */
    }
  }
  event.preventDefault();
  ctx.dragElement?.classList.add('tab-frame--dragging');
  if (typeof document !== 'undefined')
    document.body.classList.add('dragging-tab');
  deps.dragState?.setTarget(
    ctx.session.snapshot.targetPaneId && ctx.session.snapshot.zone
      ? {
          paneId: ctx.session.snapshot.targetPaneId,
          zone: ctx.session.snapshot.zone,
        }
      : undefined,
  );
  ctx.ghost = {
    title: ctx.ghost?.title ?? '',
    x: event.clientX,
    y: event.clientY,
  };
}

export function stripDragPointerUp(
  ctx: StripDragCtx,
  deps: StripDragDeps,
  event: PointerEvent,
): void {
  if (!ctx.session || event.pointerId !== ctx.session.snapshot.pointerId)
    return;
  ctx.session = moveStripPointer(ctx.session, event);
  const snap = ctx.session.snapshot;
  if (snap.active && snap.targetPaneId && snap.zone)
    deps.moveTab(
      snap.sourcePaneId,
      snap.targetPaneId,
      snap.tabId,
      snap.targetIndex ?? stripDragTargetCount(deps, snap.targetPaneId),
      tabDropEdge(snap.zone),
    );
  stripDragClear(ctx, deps);
}

export function stripDragPointerCancel(
  ctx: StripDragCtx,
  deps: StripDragDeps,
  event: PointerEvent,
): void {
  if (!ctx.session || event.pointerId !== ctx.session.snapshot.pointerId)
    return;
  stripDragClear(ctx, deps);
}

export function stripDragClear(ctx: StripDragCtx, deps: StripDragDeps): void {
  if (ctx.session) clearStripTimer(ctx.session);
  ctx.unbindWindow?.();
  ctx.unbindWindow = undefined;
  ctx.session = undefined;
  ctx.ghost = undefined;
  ctx.dragElement?.classList.remove('tab-frame--dragging');
  ctx.dragElement = undefined;
  deps.dragState?.setTarget(undefined);
  if (typeof document !== 'undefined')
    document.body.classList.remove('dragging-tab');
}

function stripDragTargetCount(
  deps: StripDragDeps,
  targetPaneId: string,
): number {
  if (targetPaneId === deps.paneId) return deps.tabCount();
  if (typeof document === 'undefined') return 0;
  return Number(
    document
      .querySelector(`[data-pane-id="${targetPaneId}"]`)
      ?.getAttribute('data-tab-count') ?? 0,
  );
}
