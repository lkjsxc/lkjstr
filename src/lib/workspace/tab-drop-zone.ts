import type { TabDropEdge } from './move-tab';

export type TabDropZone = TabDropEdge | 'center';
export type TabDropRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export function tabDropZone(
  rect: TabDropRect,
  clientX: number,
  clientY: number,
): TabDropZone {
  const x = clamp(clientX - rect.left, 0, rect.width);
  const y = clamp(clientY - rect.top, 0, rect.height);
  const xLimit = tabDropEdgeSize(rect.width);
  const yLimit = tabDropEdgeSize(rect.height);
  if (x <= xLimit) return 'left';
  if (x >= rect.width - xLimit) return 'right';
  if (y <= yLimit) return 'top';
  if (y >= rect.height - yLimit) return 'bottom';
  return 'center';
}

export function tabDropEdge(
  zone?: TabDropZone | null,
): TabDropEdge | undefined {
  return zone && zone !== 'center' ? zone : undefined;
}

export function tabDropOverlayStyle(
  rect: Pick<TabDropRect, 'width' | 'height'>,
  zone?: TabDropZone | null,
): string {
  if (!zone) return '';
  const size = tabDropOverlayRect(rect, zone);
  return [
    `--drop-left: ${size.left}px`,
    `--drop-top: ${size.top}px`,
    `--drop-width: ${size.width}px`,
    `--drop-height: ${size.height}px`,
  ].join('; ');
}

export function tabDropOverlayRect(
  rect: Pick<TabDropRect, 'width' | 'height'>,
  zone: TabDropZone,
) {
  const xLimit = tabDropEdgeSize(rect.width);
  const yLimit = tabDropEdgeSize(rect.height);
  if (zone === 'left')
    return { left: 0, top: 0, width: xLimit, height: rect.height };
  if (zone === 'right')
    return {
      left: rect.width - xLimit,
      top: 0,
      width: xLimit,
      height: rect.height,
    };
  if (zone === 'top')
    return { left: 0, top: 0, width: rect.width, height: yLimit };
  if (zone === 'bottom')
    return {
      left: 0,
      top: rect.height - yLimit,
      width: rect.width,
      height: yLimit,
    };
  return { left: 0, top: 0, width: rect.width, height: rect.height };
}

export function tabDropEdgeSize(size: number): number {
  return Math.min(96, Math.max(44, size * 0.18));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
