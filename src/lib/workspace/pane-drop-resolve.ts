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

export function paneDropRects(pane: HTMLElement): {
  readonly paneRect: TabDropRect;
  readonly bodyRect: TabDropRect;
  readonly stripBottom: number;
} {
  const paneBox = pane.getBoundingClientRect();
  const paneRect = {
    left: paneBox.left,
    top: paneBox.top,
    width: paneBox.width,
    height: paneBox.height,
  };
  const strip = pane.querySelector<HTMLElement>('.tab-strip');
  const stripBottom = strip
    ? strip.getBoundingClientRect().bottom
    : paneBox.top;
  const body =
    pane.querySelector<HTMLElement>('.pane-stack') ??
    pane.querySelector<HTMLElement>('.pane-body') ??
    pane;
  const bodyBox = body.getBoundingClientRect();
  return {
    paneRect,
    bodyRect: {
      left: bodyBox.left,
      top: bodyBox.top,
      width: bodyBox.width,
      height: bodyBox.height,
    },
    stripBottom,
  };
}

export function resolvePaneDrop(input: PaneDropInput): PaneDropResult {
  const inStrip = input.clientY <= input.stripBottom;
  const inSourceStrip =
    input.sourcePaneId === input.targetPaneId &&
    stripPriorityReorder(input.clientY, input.stripBottom);
  const zone =
    inStrip || inSourceStrip
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
