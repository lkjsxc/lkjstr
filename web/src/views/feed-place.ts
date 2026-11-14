// Where the reader is in a list: the first row on screen and how far its top is from the top of the tile. Not a
// scroll offset, which means nothing once rows above change, a tile gets another width or a picture arrives. The
// place is read from the screen whenever the reader scrolls and put back whenever anything else moves the rows.
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
  hold(): () => void;
  /** Back to the very top. */
  forget(): void;
  dispose(): void;
};

const TOP_PX = 8; // closer to the top than this is "at the top"
const SAVE_MS = 300;

export function createKeeper(o: {
  /** The scroller and, inside it, the element whose children are the rows (`data-key` on each). */
  readonly el: HTMLElement;
  readonly list: HTMLElement;
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
  /** The rows from the first one on screen, at most `n` (rows are in order, so the first is found by halving). */
  const onScreen = (n: number): { key: string; top: number }[] => {
    const top = el.getBoundingClientRect().top;
    const kids = list.children;
    let lo = 0;
    let hi = kids.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((kids[mid] as Element).getBoundingClientRect().bottom > top + 1) hi = mid;
      else lo = mid + 1;
    }
    const out: { key: string; top: number }[] = [];
    for (let i = lo; i < kids.length && out.length < n; i++) {
      const key = (kids[i] as HTMLElement).dataset.key;
      if (key && o.anchors(key))
        out.push({ key, top: (kids[i] as Element).getBoundingClientRect().top - top });
    }
    return out;
  };
  // The size the rows had when the place was last read or put. A scroll event that comes after they changed (the
  // tab landed in a tile of another width, the list got shorter and the browser clamped the scroll) is not the
  // reader's doing: reading it would overwrite the place with wherever the rows fell.
  let size = '';
  const sized = (): string => `${el.clientWidth}:${list.offsetHeight}`;
  const read = (): void => {
    if (!o.active()) return;
    if (place && size !== sized() && put()) return;
    const first = el.scrollTop < TOP_PX ? undefined : onScreen(1)[0];
    set(first && { key: first.key, off: Math.round(first.top) });
    size = sized();
  };
  const moveTo = (key: string, off: number): boolean => {
    const node = o.node(key);
    if (!node?.isConnected) return false;
    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - off;
    if (Math.abs(delta) >= 0.5) el.scrollTop += delta;
    size = sized();
    return true;
  };
  const put = (): boolean => {
    if (!o.active()) return true;
    if (place) return moveTo(place.key, place.off);
    if (el.scrollTop < TOP_PX && el.scrollTop > 0) el.scrollTop = 0;
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
    hold() {
      if (!o.active()) return () => undefined;
      // Several rows, because the first may be the one that goes away.
      const held = place ? onScreen(6) : [];
      return () => {
        if (held.some((r) => moveTo(r.key, r.top))) read();
        else put();
      };
    },
    forget() {
      set(undefined);
      el.scrollTop = 0;
    },
    dispose() {
      watch.disconnect();
      document.removeEventListener('visibilitychange', leaving);
      window.removeEventListener('pagehide', flush);
      flush();
    },
  };
}
