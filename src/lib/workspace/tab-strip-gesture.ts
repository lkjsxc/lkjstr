export const touchLongPressMs = 250;
export const touchLongPressCancelPx = 8;
export const mouseDragActivationPx = 6;

export type PointerKind = 'coarse' | 'fine';

export function pointerKind(
  pointerType: string,
  maxTouchPoints = 0,
): PointerKind {
  if (pointerType === 'touch' || maxTouchPoints > 0) return 'coarse';
  return 'fine';
}

export function shouldActivateDrag(
  kind: PointerKind,
  distance: number,
  longPressArmed: boolean,
): boolean {
  if (kind === 'coarse') return longPressArmed;
  return distance >= mouseDragActivationPx;
}

export function longPressCancelled(distance: number): boolean {
  return distance > touchLongPressCancelPx;
}

export function stripPriorityReorder(
  clientY: number,
  stripBottom: number,
): boolean {
  return clientY <= stripBottom;
}
