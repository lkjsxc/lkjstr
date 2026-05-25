import type { TabDropZone } from './tab-drop-hit';

export function tabDropOverlayStyle(
  rect: Pick<DOMRect, 'width' | 'height'>,
  zone?: TabDropZone | null,
): string {
  if (!zone) return '';
  const size = tabDropPreviewRect(rect, zone);
  return [
    `--drop-left: ${size.left}px`,
    `--drop-top: ${size.top}px`,
    `--drop-width: ${size.width}px`,
    `--drop-height: ${size.height}px`,
  ].join('; ');
}

export function tabDropPreviewRect(
  rect: Pick<DOMRect, 'width' | 'height'>,
  zone: TabDropZone,
) {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  if (zone === 'left')
    return { left: 0, top: 0, width: halfWidth, height: rect.height };
  if (zone === 'right')
    return {
      left: halfWidth,
      top: 0,
      width: halfWidth,
      height: rect.height,
    };
  if (zone === 'top')
    return { left: 0, top: 0, width: rect.width, height: halfHeight };
  if (zone === 'bottom')
    return {
      left: 0,
      top: halfHeight,
      width: rect.width,
      height: halfHeight,
    };
  return { left: 0, top: 0, width: rect.width, height: rect.height };
}
