import {
  tabDropZone,
  type TabDropRect,
  type TabDropZone,
} from './tab-drop-hit';
import { stripPriorityReorder } from './tab-strip-gesture';
import { tabInsertionIndex, type TabInsertionFrame } from './pointer-tab-drag';

export type PaneDropInput = {
  readonly paneRect: TabDropRect;
  readonly stripBottom: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly sourcePaneId: string;
  readonly targetPaneId: string;
  readonly draggedTabId: string;
  readonly frames: readonly TabInsertionFrame[];
};

export type PaneDropResult = {
  readonly zone: TabDropZone;
  readonly targetIndex: number;
  readonly edgeIntent: boolean;
};

export function resolvePaneDrop(input: PaneDropInput): PaneDropResult {
  let zone = tabDropZone(input.paneRect, input.clientX, input.clientY);
  const inStrip =
    input.sourcePaneId === input.targetPaneId &&
    stripPriorityReorder(input.clientY, input.stripBottom);
  if (inStrip) zone = 'center';
  const targetIndex = tabInsertionIndex(
    input.frames,
    input.clientX,
    input.sourcePaneId === input.targetPaneId ? input.draggedTabId : undefined,
  );
  return {
    zone,
    targetIndex,
    edgeIntent: zone !== 'center',
  };
}
