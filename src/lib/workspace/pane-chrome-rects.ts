import type { TabDropRect } from './tab-drop-hit';

export type PaneChromeRects = {
  readonly paneRect: TabDropRect;
  readonly bodyRect: TabDropRect;
  readonly chromeBottom: number;
  readonly stripBottom: number;
};

export function paneChromeRects(pane: HTMLElement): PaneChromeRects {
  const paneBox = pane.getBoundingClientRect();
  const paneRect: TabDropRect = {
    left: paneBox.left,
    top: paneBox.top,
    width: paneBox.width,
    height: paneBox.height,
  };
  const head = pane.querySelector<HTMLElement>('.pane-head');
  const chromeBottom = head ? head.getBoundingClientRect().bottom : paneBox.top;
  const strip = pane.querySelector<HTMLElement>('.tab-strip');
  const stripBottom = strip
    ? strip.getBoundingClientRect().bottom
    : chromeBottom;
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
    chromeBottom,
    stripBottom,
  };
}

/** @deprecated Use paneChromeRects */
export const paneDropRects = paneChromeRects;
