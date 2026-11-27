// Whether a list is being scrolled by its reader (docs/interface-time.md C1): a wheel, a touch, a press on it (its
// scrollbar or rail) or a scrolling key in its tile came within INTENT_MS. Scrolls the list makes itself (a restored
// tab, the keeper holding its place while notes arrive or media grows, a new note at the head) have none.
const INTENT_MS = 300;
export const TIME_LABEL_IDLE_MS = 1000;
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End', 'j', 'k']);

export type ScrollIntent = {
  /** Called on every scroll of the list: true while the label should say where the reader is. */
  telling(): boolean;
  showing(): boolean;
  dispose(): void;
};

/** `changed` runs at expiry and when a touch explicitly reveals the label. */
export function scrollIntent(
  el: HTMLElement,
  changed: () => void,
  { showOnTouch = false } = {},
): ScrollIntent {
  let at = Number.NEGATIVE_INFINITY;
  let shown = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mark = (): void => void (at = performance.now());
  const key = (e: KeyboardEvent): void => {
    const name = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.altKey || e.metaKey || e.ctrlKey || !KEYS.has(name)) return;
    if (el.isConnected && el.closest('.pane.cur')) mark();
  };
  const show = (): void => {
    shown = true;
    clearTimeout(timer);
    timer = setTimeout(() => ((shown = false), changed()), TIME_LABEL_IDLE_MS);
  };
  const touch = (): void => {
    mark();
    if (showOnTouch) show(), changed();
  };
  const inputs = [
    ['wheel', mark],
    ['pointerdown', mark],
    ['touchstart', touch],
    ['touchmove', touch],
  ] as const;
  for (const [kind, fn] of inputs) el.addEventListener(kind, fn, { passive: true });
  window.addEventListener('keydown', key, true);
  return {
    telling() {
      if (!shown && performance.now() - at > INTENT_MS) return false;
      show();
      return true;
    },
    showing: () => shown,
    dispose() {
      clearTimeout(timer);
      for (const [kind, fn] of inputs) el.removeEventListener(kind, fn);
      window.removeEventListener('keydown', key, true);
    },
  };
}
