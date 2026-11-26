// Where the reader is in a list: the first row on screen and how far its top is from the top of the tile. Not a
// scroll offset, which means nothing once rows above change, a tile gets another width or a picture arrives. The
// place is read from the screen whenever the reader scrolls and put back whenever anything else moves the rows.
import type { ListRow } from './feed-draw.ts';

export type Place = { readonly key: string; readonly off: number };

export type Keeper = {
  /** Undefined: at the very top, where the list follows its head. */
  get(): Place | undefined;
  /** Names the place and goes there (a thread opening on its focused note). */
  set(place: Place): void;
  /** Reads the place from the screen (after the reader scrolled). */
  read(): void;
  /** Puts the saved place back on screen. False when its row is not drawn. */
  put(): boolean;
  /** Before rows are redrawn; the result is called after, and keeps whatever is on screen where it was. */
  hold(preferred?: string): () => void;
  /** Back to the very top. */
  forget(): void;
  dispose(): void;
};

const TOP_PX = 8; // closer to the top than this is "at the top"
const SAVE_MS = 300;
/** A scroll this recent, or a finger on the list, means the reader is moving it (a fling coasts on its own). */
const MOVING_MS = 150;

export function createKeeper(o: {
  /** The scroller and, inside it, the element whose children are the rows (`data-key` on each). */
  readonly el: HTMLElement;
  readonly list: HTMLElement;
  /** Space to hold a selected note when the list would otherwise be too short to scroll. */
  readonly stretch?: HTMLElement;
  readonly saved: Place | undefined;
  /** On screen right now: a hidden tab has nothing to read and nothing to put. */
  readonly active: () => boolean;
  readonly node: (key: string) => HTMLElement | undefined;
  /** Rows that are not content (day dividers) are never the anchor. */
  readonly anchors: (key: string) => boolean;
  readonly save: (place: Place | undefined) => void;
}): Keeper {
  const { el, list } = o;
  let place = o.saved;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let fraction = 0;
  // Any write to scrollTop stops a fling's momentum on a phone. While the reader moves the list, the place read at
  // `readAt` is behind the screen by however far it has scrolled since: a put allows for that and writes only when
  // rows above really changed height.
  let readAt = el.scrollTop;
  let coasting = false; // a move made while the reader moves the list
  let touching = false;
  let scrolledAt = -Infinity;
  const moving = (): boolean => touching || performance.now() - scrolledAt < MOVING_MS;
  const touched = (on: boolean) => (): void => {
    touching = on;
    scrolledAt = performance.now();
  };
  const onTouch = touched(true);
  const onLift = touched(false);
  const onScroll = (): void => void (scrolledAt = performance.now());
  el.addEventListener('touchstart', onTouch, { passive: true });
  el.addEventListener('touchend', onLift, { passive: true });
  el.addEventListener('touchcancel', onLift, { passive: true });
  el.addEventListener('scroll', onScroll, { passive: true });
  const shiftList = (next: number): void => {
    if (next === fraction) return;
    fraction = next;
    list.style.translate = next ? `0 ${next}px` : '';
  };
  const flush = (): void => {
    clearTimeout(timer);
    timer = undefined;
    if (dirty) (dirty = false), o.save(place);
  };
  const set = (next: Place | undefined): void => {
    if (next?.key === place?.key && next?.off === place?.off) return;
    place = next;
    dirty = true;
    timer ??= setTimeout(flush, SAVE_MS);
  };
  /** Rows from the top of the viewport, including all visible candidates when holding a redraw. */
  const onScreen = (
    n: number,
    holding = false,
  ): { key: string; top: number; covered: boolean }[] => {
    const { top, bottom } = el.getBoundingClientRect();
    const kids = list.children;
    let lo = 0;
    let hi = kids.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((kids[mid] as Element).getBoundingClientRect().bottom > top + 1) hi = mid;
      else lo = mid + 1;
    }
    const out: ReturnType<typeof onScreen> = [];
    for (let i = lo; i < kids.length; i++) {
      const child = kids[i] as HTMLElement;
      const row = child.getBoundingClientRect();
      if (out.length >= n && (!holding || row.top >= bottom)) break;
      const key = child.dataset.key;
      if (key && o.anchors(key))
        out.push({
          key,
          top: row.top - top,
          covered: child.classList.contains('hid'),
        });
    }
    return out;
  };
  // The size the rows had when the place was last read or put. A scroll event that comes after they changed (the
  // tab landed in a tile of another width, the list got shorter and the browser clamped the scroll) is not the
  // reader's doing: reading it would overwrite the place with wherever the rows fell.
  let size = '';
  const sized = (): string => `${el.clientWidth}:${list.offsetHeight}`;
  const take = (): void => {
    if (el.scrollTop < TOP_PX) shiftList(0);
    const first = el.scrollTop < TOP_PX ? undefined : onScreen(1)[0];
    set(first && { key: first.key, off: first.top });
    size = sized();
    readAt = el.scrollTop;
  };
  const read = (): void => {
    if (!o.active()) return;
    if (place && size !== sized() && put()) return;
    take();
  };
  const moveTo = (key: string, off: number, selected = false): boolean => {
    const node = o.node(key);
    if (!node?.isConnected) return false;
    const delta =
      node.getBoundingClientRect().top - el.getBoundingClientRect().top - off - fraction;
    const tail = selected ? o.stretch : undefined;
    if (tail && el.scrollTop + delta > el.scrollHeight - el.clientHeight) {
      const bottom = tail.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
      const deficit = Math.ceil(el.clientHeight + delta - bottom);
      tail.style.height = `${tail.offsetHeight + Math.max(0, deficit)}px`;
    }
    const before = el.scrollTop;
    // In motion a sub-pixel is left to the shift below, so nothing touches the scroll.
    if (Math.abs(delta) >= (coasting ? 1 : 0.5)) el.scrollTop += delta;
    // Scroll positions can round to a device pixel even when row heights are fractional.
    const remainder = delta - (el.scrollTop - before);
    if (Math.abs(remainder) < 1) shiftList(-remainder);
    size = sized();
    readAt = el.scrollTop;
    return true;
  };
  const put = (): boolean => {
    if (!o.active()) return true;
    if (place && moving()) {
      coasting = true;
      const kept = moveTo(place.key, place.off - (el.scrollTop - readAt));
      coasting = false;
      if (kept) take(); // the place is where the reader has got to
      return kept;
    }
    if (place) return moveTo(place.key, place.off);
    if (el.scrollTop < TOP_PX) shiftList(0);
    if (el.scrollTop < TOP_PX && el.scrollTop > 0 && !moving()) el.scrollTop = 0;
    return true;
  };
  // A picture that loads, a font that arrives, a note that unfolds, a tile that gets another width: all change the
  // height of rows, and all are seen here before the frame is painted.
  const watch = new ResizeObserver(() => void put());
  watch.observe(list);
  watch.observe(el);
  const leaving = (): void => void (document.visibilityState === 'hidden' && flush());
  document.addEventListener('visibilitychange', leaving);
  window.addEventListener('pagehide', flush);

  return {
    get: () => place,
    set: (next) => (set(next), void put()),
    read,
    put,
    hold(preferred) {
      if (!o.active()) return () => undefined;
      // Several rows, because the first may be the one that goes away.
      const held = place || el.scrollTop >= TOP_PX ? onScreen(6, true) : [];
      const node = preferred && o.node(preferred);
      if (node) {
        const row = node.getBoundingClientRect();
        const view = el.getBoundingClientRect();
        if (row.bottom > view.top && row.top < view.bottom)
          held.unshift({
            key: preferred,
            top: row.top - view.top,
            covered: node.classList.contains('hid'),
          });
      }
      return () => {
        coasting = moving();
        // A note just covered by a mute has lost its body. Keep the next surviving anchor.
        const kept = held.some(
          (r) =>
            (r.covered || !o.node(r.key)?.classList.contains('hid')) &&
            moveTo(r.key, r.top, r.key === preferred),
        );
        coasting = false;
        if (kept) read();
        else put();
      };
    },
    forget() {
      set(undefined);
      shiftList(0);
      if (o.stretch) o.stretch.style.height = '';
      el.scrollTop = 0;
    },
    dispose() {
      watch.disconnect();
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('touchend', onLift);
      el.removeEventListener('touchcancel', onLift);
      el.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', leaving);
      window.removeEventListener('pagehide', flush);
      flush();
    },
  };
}

/** How long after a thread first shows its focus the place may still follow notes arriving above it. */
const LAND_MS = 3000;

/** Seats a thread on its focused note about a third down the tile, with what it answers above it, as far as the
 * focus and its reply field still fit under that; the tail gives the focus room to sit there however few replies
 * there are. Until the reader scrolls, presses or types, or LAND_MS has passed, notes arriving above keep it there. */
export function createThreadSeat(
  el: HTMLElement,
  tail: HTMLElement,
  keeper: Keeper,
  seated: boolean,
  nodeFor: (key: string) => HTMLElement | undefined,
) {
  let until = 0; // when landing ends; 0 before the focus is first seated, -1 once the reader has moved
  const moved = (): void => void (until = -1);
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const)
    el.addEventListener(type, moved, { passive: true, once: true });
  return (rows: readonly ListRow[]): void => {
    const focus = rows.find((row) => row.kind === 'note' && row.thread?.role === 'focus');
    const node = focus && nodeFor(focus.key);
    if (!node) return;
    const top = node.getBoundingClientRect().top;
    const above = top - el.getBoundingClientRect().top + el.scrollTop; // the room of everything above the focus
    const say = el.querySelector('.tsay')?.getBoundingClientRect().bottom ?? 0;
    const whole = Math.max(node.getBoundingClientRect().bottom, say) - top; // the focus and its reply field
    const want = Math.round(
      Math.max(0, Math.min(above, el.clientHeight / 3, el.clientHeight - whole)),
    );
    const below = tail.getBoundingClientRect().top - top;
    tail.style.height = `${Math.max(0, Math.ceil(el.clientHeight - want - below))}px`;
    if (!seated) (seated = true), until || (until = performance.now() + LAND_MS);
    else if (until <= 0 || performance.now() > until) return;
    // Only a focus that is not where it should be is moved: setting the same place again would save it again.
    if (above > 0 && Math.abs(top - el.getBoundingClientRect().top - want) >= 1)
      keeper.set({ key: focus.key, off: want });
  };
}
