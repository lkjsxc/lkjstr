// Tab bar behaviour: the guarded close button, and the row of tabs beside the tile's four buttons, which alone
// scrolls sideways (by the wheel too) with a "more tabs this way" fade; the buttons stay where they are (owner,
// 2026-11-22).
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';

const ARM_MS = 2500; // a started close is forgotten after this long without another click

/** × that closes on the n-th click; until then a ring fills around it (`--p` is the filled fraction). */
export function closeButton(need: () => number, run: () => void): HTMLElement {
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = (): void => {
    const left = need() - count;
    el.classList.toggle('arming', count > 0);
    el.style.setProperty('--p', String(count / need()));
    el.title = count ? t('tab.closeMore', { n: left }) : t('tab.close');
  };
  const el: HTMLElement = h(
    'button',
    {
      class: 'x',
      title: t('tab.close'),
      'aria-label': t('tab.close'),
      onpointerdown: (e) => e.stopPropagation(),
      onclick: () => {
        clearTimeout(timer);
        if (++count >= need()) return run();
        timer = setTimeout(() => ((count = 0), show()), ARM_MS);
        show();
      },
    },
    '×',
  );
  return el;
}

/** Marks which sides of a row hide more tabs; ui.css fades the tabs out toward those sides. */
function fade(strip: HTMLElement): void {
  const max = strip.scrollWidth - strip.clientWidth;
  strip.classList.toggle('more-l', strip.scrollLeft > 1);
  strip.classList.toggle('more-r', strip.scrollLeft < max - 1);
}

// One observer for the bars of the current layout: a new render drops the old bars (bound: panes on screen).
const sizes = new ResizeObserver((entries) => {
  for (const e of entries) fade(e.target as HTMLElement);
});
export const forgetStrips = (): void => sizes.disconnect();

/** A tile's bar: its buttons, which never scroll, then its tabs in a row of their own (`.tabrow`). */
export function strip(buttons: HTMLElement[], tabs: HTMLElement[]): HTMLElement {
  const row = h('div', { class: 'tabrow' }, tabs);
  row.addEventListener('scroll', () => fade(row), { passive: true });
  // A vertical wheel scrolls the row sideways when it holds more tabs than fit.
  row.addEventListener('wheel', (e) => {
    if (!e.deltaY || row.scrollWidth <= row.clientWidth) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  });
  sizes.observe(row);
  return h('div', { class: 'strip' }, buttons, row);
}

const EDGE = 28; // the fade: a tab under it is not really in view

/** A new render makes new bars. Call before it with the old tiles; the result, called with the new ones, puts each
 * row of tabs back where it was scrolled and then brings the tab in front into view, so it never hides past an edge. */
export function keepStrips(old: ReadonlyMap<string, HTMLElement>) {
  const left = new Map<string, number>(); // bound: panes on screen
  for (const [id, el] of old) left.set(id, el.querySelector('.tabrow')?.scrollLeft ?? 0);
  return (next: ReadonlyMap<string, HTMLElement>): void => {
    for (const [id, el] of next) {
      const bar = el.querySelector<HTMLElement>('.tabrow');
      const tab = bar?.querySelector<HTMLElement>('.tab.active');
      if (!bar || !tab) continue;
      bar.scrollLeft = left.get(id) ?? 0;
      const b = bar.getBoundingClientRect();
      const r = tab.getBoundingClientRect();
      // The bar is drawn at the interface scale; the tab gives it even when the row has no width left.
      const zoom = r.width / tab.offsetWidth || 1;
      // A row with no room for the fades beside the tab gives them up; narrower than the tab, it shows its start.
      const edge = Math.min(EDGE, Math.max(0, (b.width - r.width) / 2));
      const shift =
        r.left < b.left + edge || r.width > b.width - 2 * edge
          ? r.left - (b.left + edge)
          : Math.max(0, r.right - (b.right - edge));
      bar.scrollLeft += shift / zoom;
      fade(bar);
    }
  };
}
