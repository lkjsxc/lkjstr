import {
  tabDropZone,
  type TabDropRect,
  type TabDropZone,
} from './tab-drop-hit';
import { stripPriorityReorder } from './tab-strip-gesture';
import { tabInsertionIndex, type TabInsertionFrame } from './pointer-tab-drag';

export type PaneDropInput = {
  readonly paneRect: TabDropRect;
  readonly bodyRect: TabDropRect;
  readonly chromeBottom: number;
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
  const inChrome = input.clientY <= input.chromeBottom;
  const inSourceStrip =
    input.sourcePaneId === input.targetPaneId &&
    stripPriorityReorder(input.clientY, input.stripBottom);
  const aboveBody = input.clientY < input.bodyRect.top;
  const zone =
    inChrome || inSourceStrip || aboveBody
      ? 'center'
      : tabDropZone(input.bodyRect, input.clientX, input.clientY);
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

export { paneChromeRects, paneDropRects } from './pane-chrome-rects';
