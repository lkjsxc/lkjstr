import {
  activatePointerDrag,
  pointerDragTarget,
  startPointerTabDrag,
  type PointerDragSnapshot,
} from './pointer-tab-drag';
import {
  longPressCancelled,
  pointerKind,
  shouldActivateDrag,
  touchLongPressMs,
} from './tab-strip-gesture';

export type StripPointerSession = {
  readonly snapshot: PointerDragSnapshot;
  readonly kind: ReturnType<typeof pointerKind>;
  longPressArmed: boolean;
  longPressTimer?: ReturnType<typeof setTimeout>;
};

export function startStripPointer(
  paneId: string,
  tabId: string,
  event: PointerEvent,
): StripPointerSession {
  const kind = pointerKind(event.pointerType);
  const session: StripPointerSession = {
    snapshot: startPointerTabDrag(
      paneId,
      tabId,
      event.pointerId,
      event.clientX,
      event.clientY,
    ),
    kind,
    longPressArmed: false,
  };
  if (kind === 'coarse') {
    session.longPressTimer = setTimeout(() => {
      session.longPressArmed = true;
    }, touchLongPressMs);
  }
  return session;
}

export function moveStripPointer(
  session: StripPointerSession,
  event: PointerEvent,
): StripPointerSession {
  if (event.pointerId !== session.snapshot.pointerId) return session;
  const distance = Math.hypot(
    event.clientX - session.snapshot.startX,
    event.clientY - session.snapshot.startY,
  );
  if (
    session.kind === 'coarse' &&
    !session.longPressArmed &&
    longPressCancelled(distance)
  ) {
    clearStripTimer(session);
    return session;
  }
  const active = shouldActivateDrag(
    session.kind,
    distance,
    session.longPressArmed,
  );
  let snapshot = activatePointerDrag(
    session.snapshot,
    event.clientX,
    event.clientY,
  );
  if (!active) return { ...session, snapshot };
  snapshot = { ...snapshot, active: true };
  if (typeof document !== 'undefined')
    snapshot = pointerDragTarget(document, snapshot);
  return { ...session, snapshot };
}

export function clearStripTimer(session: StripPointerSession): void {
  if (session.longPressTimer) clearTimeout(session.longPressTimer);
  session.longPressArmed = false;
  session.longPressTimer = undefined;
}
