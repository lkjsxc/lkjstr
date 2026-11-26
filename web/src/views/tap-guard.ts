// A press that lands just after the rows moved under it (a reaction arrived, a note came in at the top, a row grew)
// was aimed at whatever was there before. For SHIFT_MS after such a move, a press on a row or a control that moved,
// or that came in as others moved, does nothing (owner, 2026-11-26: about 0.4s); what stayed put works.
// What is on screen is noted whenever the list is still, and compared each time a row changes size. The reader's own
// scrolling is not a move: it is never compared, only noted again once it stops.

const SHIFT_MS = 400;
const MOVED_PX = 3; // less than this is a rounding, not a move
const STILL_MS = 120; // no scroll for this long: the list is still
const PRESS = 'a, button, [role="button"], .mbox';

export function guardTaps(el: HTMLElement, list: HTMLElement): () => void {
  /** Where each row and control on screen was, by node. Bound: the nodes on screen. */
  let tops = new WeakMap<Element, number>();
  let noted = false; // `tops` matches the screen as last seen still
  let notedAt = 0; // the scroll then
  let moved = new WeakSet<Element>();
  let movedAt = -Infinity;
  let swallow = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** The rows on screen (rows are in order, so the first is found by halving), each with its controls. */
  const onScreen = (visit: (node: Element, top: number) => void): void => {
    const view = el.getBoundingClientRect();
    const kids = list.children;
    let lo = 0;
    let hi = kids.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((kids[mid] as Element).getBoundingClientRect().bottom > view.top) hi = mid;
      else lo = mid + 1;
    }
    for (let i = lo; i < kids.length; i++) {
      const row = kids[i] as Element;
      const top = row.getBoundingClientRect().top;
      if (top >= view.bottom) break;
      // A composer can resize as the reader edits it, including the reply form inside a thread.
      if (!row.matches('.note, .notif')) continue;
      visit(row, top);
      for (const c of row.querySelectorAll(PRESS)) visit(c, c.getBoundingClientRect().top);
    }
  };
  const note = (): void => {
    const next = new WeakMap<Element, number>();
    onScreen((node, top) => next.set(node, top));
    tops = next;
    noted = true;
    notedAt = el.scrollTop;
  };
  const compare = (): void => {
    if (!noted) return note();
    const next = new WeakMap<Element, number>();
    const shifted = new WeakSet<Element>();
    let any = false;
    onScreen((node, top) => {
      next.set(node, top);
      const was = tops.get(node);
      // New nodes count only beside nodes that moved: rows coming into an empty list took nobody's place.
      if (was === undefined) shifted.add(node);
      else if (Math.abs(was - top) >= MOVED_PX) (any = true), shifted.add(node);
    });
    tops = next;
    notedAt = el.scrollTop;
    if (any) (moved = shifted), (movedAt = performance.now());
  };
  const scrolled = (): void => {
    if (el.scrollTop === notedAt) return; // a write that kept everything where it was
    noted = false;
    movedAt = -Infinity; // Scrolling makes the previous screen positions irrelevant to the next press.
    clearTimeout(timer);
    timer = setTimeout(note, STILL_MS);
  };
  const press = (e: PointerEvent): void => {
    swallow = false;
    // A touch has no cursor to follow a control when the screen moves under the reader's finger.
    if (e.pointerType !== 'touch' || !e.isPrimary || performance.now() - movedAt > SHIFT_MS) return;
    const at = e.target as Element;
    const aimed = at.closest?.(PRESS) ?? at.closest?.('.list > *');
    swallow = Boolean(aimed && list.contains(aimed) && moved.has(aimed));
  };
  const click = (e: MouseEvent): void => {
    if (!swallow) return;
    swallow = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  // After the keeper's own observer (made first), so rows are already back in their place.
  const watch = new ResizeObserver(compare);
  watch.observe(list);
  el.addEventListener('scroll', scrolled, { passive: true });
  el.addEventListener('pointerdown', press, true);
  el.addEventListener('click', click, true);
  return () => {
    clearTimeout(timer);
    watch.disconnect();
    el.removeEventListener('scroll', scrolled);
    el.removeEventListener('pointerdown', press, true);
    el.removeEventListener('click', click, true);
  };
}
