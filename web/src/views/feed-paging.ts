import type { feedWindow } from './feed-window.ts';

export const PAGE = 60;
export const LIMIT = 800;

export const clampFeedWindow = (before: number, after: number): [number, number] => {
  const extra = Math.max(0, before + after - LIMIT);
  return before > after ? [before - extra, after] : [before, after - extra];
};

/** Measure the gap in pane heights, with one demand per boundary while it is unchanged. */
export function createFeedPaging(el: HTMLElement, follow: () => void, read: () => void) {
  let askedOlder: string | undefined;
  let askedNewer: string | undefined;
  let frame = 0;
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), follow()));
  };
  const scroll = (): void => (read(), schedule());
  el.addEventListener('scroll', scroll, { passive: true });
  return {
    schedule,
    dispose() {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', scroll);
    },
    next(
      { first, last }: ReturnType<typeof feedWindow>,
      atTop: boolean,
      atBottom: boolean,
      overflow: boolean,
    ) {
      const lookahead = el.clientHeight * 2.5;
      const bottomGap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (!atBottom && last && last !== askedOlder && bottomGap < lookahead) {
        askedOlder = last;
        askedNewer = undefined;
        return 'older';
      }
      if (!atTop && !overflow && first && first !== askedNewer && el.scrollTop < lookahead) {
        askedNewer = first;
        askedOlder = undefined;
        return 'newer';
      }
    },
    reset() {
      askedOlder = askedNewer = undefined;
    },
  };
}
