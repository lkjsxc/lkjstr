// Where a thread tab seats its focus (feed-place.ts, createThreadSeat), read from the screen for the smokes and shots.
import type { Page } from 'playwright-core';

export type Seat = {
  /** The focus's top below the tile's top, and a third of the tile. */
  readonly top: number;
  readonly third: number;
  /** Rows drawn above the focus (notes, the room of one looked for, a fold). */
  readonly above: number;
  /** The row just above the focus, what it answers, is at least partly in view. */
  readonly context: boolean;
  /** The focus and its reply field fit the tile together, and are whole on screen. */
  readonly fits: boolean;
  readonly whole: boolean;
};

export const seatOf = (
  page: Page,
  view = '.view[data-kind="thread"]:visible',
): Promise<Seat | null> =>
  page
    .locator(view)
    .first()
    .evaluate((v) => {
      const focus = v.querySelector('.th-focus');
      if (!focus) return null;
      const box = v.getBoundingClientRect();
      const r = focus.getBoundingClientRect();
      const end = Math.max(r.bottom, v.querySelector('.tsay')?.getBoundingClientRect().bottom ?? 0);
      const prev = focus.previousElementSibling?.getBoundingClientRect();
      return {
        top: Math.round(r.top - box.top),
        third: Math.round(v.clientHeight / 3),
        above: v.querySelectorAll('.list > .th-ancestor, .list > .tslot, .list > .tfold.th-above')
          .length,
        context: Boolean(prev && prev.bottom > box.top + 1),
        fits: end - r.top <= v.clientHeight,
        whole: end <= box.bottom + 1,
      };
    });

/** With notes above, the focus sits below the tile's top, no lower than a third, with what it answers in view; with
 * none, or when the focus and its field fill the tile, at the top. The focus and its field are whole when they fit. */
export const seated = (s: Seat | null): boolean =>
  s !== null &&
  (s.above === 0 || !s.fits ? s.top === 0 : s.top > 0 && s.top <= s.third + 1 && s.context) &&
  (!s.fits || s.whole);
