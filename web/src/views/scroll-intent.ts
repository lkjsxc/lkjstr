// Whether a list is being scrolled by its reader (docs/interface-time.md C1): a wheel, a touch, a press on it (its
// scrollbar or rail) or a scrolling key in its tile came within INTENT_MS. Scrolls the list makes itself (a restored
// tab, the keeper holding its place while notes arrive or media grows, a new note at the head) have none.
const INTENT_MS = 300;
const GONE_MS = 1000; // the label goes this long after the last scroll
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End', 'j', 'k']);

export type ScrollIntent = {
  /** Called on every scroll of the list: true while the label should say where the reader is. */
  telling(): boolean;
  dispose(): void;
};

/** `gone` runs once the label should go. */
export function scrollIntent(el: HTMLElement, gone: () => void): ScrollIntent {
  let at = Number.NEGATIVE_INFINITY;
  let shown = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mark = (): void => void (at = performance.now());
  const key = (e: KeyboardEvent): void => {
    const name = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.altKey || e.metaKey || e.ctrlKey || !KEYS.has(name)) return;
    if (el.isConnected && el.closest('.pane.cur')) mark();
  };
  const kinds = ['wheel', 'touchstart', 'touchmove', 'pointerdown'] as const;
  for (const kind of kinds) el.addEventListener(kind, mark, { passive: true });
  window.addEventListener('keydown', key, true);
  return {
    telling() {
      if (!shown && performance.now() - at > INTENT_MS) return false;
      shown = true;
      clearTimeout(timer);
      timer = setTimeout(() => ((shown = false), gone()), GONE_MS);
      return true;
    },
    dispose() {
      clearTimeout(timer);
      for (const kind of kinds) el.removeEventListener(kind, mark);
      window.removeEventListener('keydown', key, true);
    },
  };
}
