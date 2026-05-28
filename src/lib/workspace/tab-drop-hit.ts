import type { TabDropEdge } from './move-tab';

export type TabDropZone = TabDropEdge | 'center';
export type TabDropRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export function tabDropHitSize(size: number): number {
  return Math.min(
    128,
    Math.max(56, Math.round(size * 0.28)),
    Math.max(1, Math.floor(size / 2) - 1),
  );
}

export function tabDropZone(
  rect: TabDropRect,
  clientX: number,
  clientY: number,
): TabDropZone {
  const x = clamp(clientX - rect.left, 0, rect.width);
  const y = clamp(clientY - rect.top, 0, rect.height);
  const xLimit = tabDropHitSize(rect.width);
  const yLimit = tabDropHitSize(rect.height);
  if (x <= xLimit) return 'left';
  if (x >= rect.width - xLimit) return 'right';
  if (y <= yLimit) return 'top';
  if (y >= rect.height - yLimit) return 'bottom';
  return 'center';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
