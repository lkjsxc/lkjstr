// While the scrollbar of a list is held, a small label beside the thumb says the time of the row at the top of
// the tile, so a long list can be travelled by time. How much it says follows the span of what is loaded: the
// time of day within one day, the date with the time across days, the date alone across months.
import type { Row } from '../engine/protocol.ts';
import { clockOf, dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';

const DAY = 86_400_000;
const IDLE_MS = 1500; // a held thumb that does not move for this long lets the label go

/** When a row happened (0: a row without a time, such as a profile's header). */
export const rowTime = (row: Row | undefined): number =>
  row?.kind === 'note' ? (row.repostedBy?.at ?? row.at) : row?.kind === 'notification' ? row.at : 0;
/** The label for `at` in a list that spans `from` to `to`. Pure, tested. */
export function scrubText(at: number, from: number, to: number): string {
  const span = Math.abs(to - from);
  if (span > 90 * DAY) return dayOf(at);
  return dayOf(from) === dayOf(to) ? clockOf(at) : `${dayOf(at)} ${clockOf(at)}`;
}

export function mountScrub(o: {
  /** The scroller, the holder pinned to its top, and the element whose children are the rows. */
  readonly el: HTMLElement;
  readonly pin: HTMLElement;
  readonly list: HTMLElement;
  readonly row: (key: string) => Row | undefined;
}): () => void {
  const { el, list } = o;
  const label = h('div', { class: 'scrub', hidden: true, 'aria-hidden': 'true' });
  o.pin.append(label);
  let held = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const times = (): number[] =>
    [...list.children]
      .map((c) => rowTime(o.row((c as HTMLElement).dataset.key ?? '')))
      .filter((at) => at > 0);
  /** The first row with a time at or below the top of the tile (rows are in order: found by halving). */
  const first = (): number => {
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
      const at = rowTime(o.row((kids[i] as HTMLElement).dataset.key ?? ''));
      if (at) return at;
    }
    return 0;
  };
  const show = (): void => {
    const at = first();
    const all = times();
    if (!at || !all.length) return void (label.hidden = true);
    label.textContent = scrubText(at, all[0] ?? at, all[all.length - 1] ?? at);
    label.hidden = false;
    const room = el.scrollHeight - el.clientHeight;
    const span = el.clientHeight - label.offsetHeight - 8;
    label.style.top = `${4 + (room > 0 ? (el.scrollTop / room) * span : 0)}px`;
  };
  const end = (): void => {
    held = false;
    clearTimeout(idle);
    label.hidden = true;
  };
  const down = (e: MouseEvent): void => {
    // A press on the scroller itself, to the right of its content: the scrollbar.
    if (e.target !== el || e.button !== 0 || e.offsetX < el.clientWidth) return;
    held = true;
    show();
  };
  const scroll = (): void => {
    if (!held) return;
    show();
    clearTimeout(idle);
    idle = setTimeout(end, IDLE_MS);
  };
  const move = (e: MouseEvent): void => void (held && e.buttons === 0 && end());
  el.addEventListener('mousedown', down);
  el.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('mouseup', end, true);
  window.addEventListener('mousemove', move, true);
  window.addEventListener('blur', end);
  return () => {
    end();
    label.remove();
    el.removeEventListener('mousedown', down);
    el.removeEventListener('scroll', scroll);
    window.removeEventListener('mouseup', end, true);
    window.removeEventListener('mousemove', move, true);
    window.removeEventListener('blur', end);
  };
}
