export type { TabDropRect, TabDropZone } from './tab-drop-hit';
export { tabDropHitSize, tabDropZone } from './tab-drop-hit';
export { tabDropOverlayStyle, tabDropPreviewRect } from './tab-drop-preview';
export type { TabDropEdge } from './move-tab';

import type { TabDropZone } from './tab-drop-hit';
import type { TabDropEdge } from './move-tab';
import { tabDropPreviewRect as previewRect } from './tab-drop-preview';

export function tabDropEdge(
  zone?: TabDropZone | null,
): TabDropEdge | undefined {
  return zone && zone !== 'center' ? zone : undefined;
}

export function tabDropEdgeSize(size: number): number {
  return Math.min(96, Math.max(44, size * 0.22));
}

export function tabDropOverlayRect(
  rect: Pick<DOMRect, 'width' | 'height'>,
  zone: TabDropZone,
) {
  return previewRect(rect, zone);
}
