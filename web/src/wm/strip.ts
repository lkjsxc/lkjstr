// Tab bar behaviour: the guarded close button, sideways wheel scrolling and the "more tabs this way" fade.
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

/** Marks which sides of a bar hide more tabs; ui.css fades the tabs out toward those sides. */
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

export function strip(children: (HTMLElement | HTMLElement[])[]): HTMLElement {
  const el = h('div', { class: 'strip' }, children);
  el.addEventListener('scroll', () => fade(el), { passive: true });
  // A vertical wheel scrolls the bar sideways when it holds more tabs than fit.
  el.addEventListener('wheel', (e) => {
    if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  });
  sizes.observe(el);
  return el;
}

const EDGE = 28; // the fade: a tab under it is not really in view

/** A new render makes new bars. Call before it with the old tiles; the result, called with the new ones, puts each
 * bar back where it was scrolled and then brings the tab in front into view, so it never hides past an edge. */
export function keepStrips(old: ReadonlyMap<string, HTMLElement>) {
  const left = new Map<string, number>(); // bound: panes on screen
  for (const [id, el] of old) left.set(id, el.querySelector('.strip')?.scrollLeft ?? 0);
  return (next: ReadonlyMap<string, HTMLElement>): void => {
    for (const [id, el] of next) {
      const bar = el.querySelector<HTMLElement>('.strip');
      const tab = bar?.querySelector<HTMLElement>('.tab.active');
      if (!bar || !tab) continue;
      bar.scrollLeft = left.get(id) ?? 0;
      const b = bar.getBoundingClientRect();
      const r = tab.getBoundingClientRect();
      const zoom = b.width / bar.offsetWidth || 1; // the bar is drawn at the interface scale
      if (r.right > b.right - EDGE) bar.scrollLeft += (r.right - (b.right - EDGE)) / zoom;
      if (r.left < b.left + EDGE) bar.scrollLeft -= (b.left + EDGE - r.left) / zoom;
      fade(bar);
    }
  };
}
