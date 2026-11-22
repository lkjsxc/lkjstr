// While the reader scrolls a list in time order, a small label beside the scrollbar's thumb says the date and time of
// the row at the top of the tile, `yyyy/mm/dd HH:mm` (docs/interface-time.md C1). A list on the time rail says it at
// the rail's place line (time-rail.ts); this one stands beside a native scrollbar, or beside the rail's reserved room
// while the rail has nothing to draw.
import { clockOf, dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import type { ListRow } from './feed-draw.ts';
import { scrollIntent } from './scroll-intent.ts';

/** When a row happened (0: a row without a time, such as a profile's header). A repost reads as the repost's time. */
export const rowTime = (row: ListRow | undefined): number =>
  row?.kind === 'note'
    ? (row.readingAt ?? row.repostedBy?.at ?? row.at)
    : row?.kind === 'notification'
      ? row.at
      : 0;
/** The label for `at`: always the whole local date and time, whatever the list spans. Pure, tested. */
export const timeText = (at: number): string => `${dayOf(at)} ${clockOf(at)}`;

/** The centre for a label at `y` (px from the tile's top), kept 4px inside a tile `view` tall. */
export const centred = (label: HTMLElement, y: number, view: number): number =>
  Math.min(view - label.offsetHeight / 2 - 4, Math.max(label.offsetHeight / 2 + 4, y));

/** The first row with a time at or below the top of the tile (rows are in order: found by halving). */
export function topRow(
  el: HTMLElement,
  list: HTMLElement,
  row: (key: string) => ListRow | undefined,
): ListRow | undefined {
  const top = el.getBoundingClientRect().top;
  const kids = list.children;
  let lo = 0;
  let hi = kids.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((kids[mid] as Element).getBoundingClientRect().bottom > top + 1) hi = mid;
    else lo = mid + 1;
  }
  for (let i = lo; i < kids.length; i++) {
    const found = row((kids[i] as HTMLElement).dataset.key ?? '');
    if (rowTime(found)) return found;
  }
}

export function mountScrub(o: {
  /** The scroller, the holder pinned to its top, and the element whose children are the rows. */
  readonly el: HTMLElement;
  readonly pin: HTMLElement;
  readonly list: HTMLElement;
  readonly row: (key: string) => ListRow | undefined;
}): () => void {
  const { el, pin, list } = o;
  const label = h('div', { class: 'scrub', hidden: true, 'aria-hidden': 'true' });
  pin.append(label);
  const intent = scrollIntent(el, () => void (label.hidden = true));
  // A shown rail says the time at its own place line.
  const rail = (): boolean =>
    el.querySelector(':scope > .time-pin > .time-rail:not([hidden])') !== null;
  const scroll = (): void => {
    if (rail() || !intent.telling()) return void (label.hidden = true);
    const at = rowTime(topRow(el, list, o.row));
    if (!at) return void (label.hidden = true);
    label.textContent = timeText(at);
    label.hidden = false;
    // Centred on the native thumb, as the browser draws it: at least 24px, in proportion to what is shown.
    const view = el.clientHeight;
    const room = el.scrollHeight - view;
    const thumb = Math.max(24, (view * view) / Math.max(1, el.scrollHeight));
    const centre = room > 0 ? (el.scrollTop / room) * (view - thumb) + thumb / 2 : view / 2;
    const y = centred(label, centre, view) - label.offsetHeight / 2;
    label.style.top = `${y - (pin.getBoundingClientRect().top - el.getBoundingClientRect().top)}px`;
  };
  el.addEventListener('scroll', scroll, { passive: true });
  return () => {
    intent.dispose();
    label.remove();
    el.removeEventListener('scroll', scroll);
  };
}
