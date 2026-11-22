// The tab in front is brought into its row after a render (wm/strip.ts keepStrips), the bar being drawn zoomed
// (1.2 here): clear of the fades when the row holds it, its start shown when the row is narrower than it, also
// when the tile's pinned buttons leave the row no width at all.
import { describe, expect, it, vi } from 'vitest';
import { keepStrips } from '../src/wm/strip.ts';

const ZOOM = 1.2;
/** A pane whose row starts at screen x `rowLeft`, is `rowWidth` wide as drawn, and whose front tab starts `tabAt`
 * CSS px into the row's content and is `tabWidth` CSS px wide. Rects follow scrollLeft as a browser's would. */
function pane(rowLeft: number, rowWidth: number, tabAt: number, tabWidth: number) {
  const el = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'tabrow';
  const tab = document.createElement('div');
  tab.className = 'tab active';
  row.append(tab);
  el.append(row);
  let scroll = 0;
  Object.defineProperty(row, 'scrollLeft', {
    get: () => scroll,
    set: (v: number) => void (scroll = Math.max(0, v)),
  });
  Object.defineProperty(row, 'scrollWidth', { value: tabAt + tabWidth });
  Object.defineProperty(row, 'clientWidth', { value: rowWidth / ZOOM });
  Object.defineProperty(row, 'offsetWidth', { value: rowWidth / ZOOM });
  Object.defineProperty(tab, 'offsetWidth', { value: tabWidth });
  vi.spyOn(row, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(rowLeft, 0, rowWidth, 29),
  );
  vi.spyOn(tab, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(rowLeft + (tabAt - scroll) * ZOOM, 0, tabWidth * ZOOM, 29),
  );
  return { el, row, tab };
}
const reveal = (p: ReturnType<typeof pane>) => keepStrips(new Map())(new Map([['p', p.el]]));

describe('the tab in front after a render', () => {
  it('stands clear of the fade when its row holds it', () => {
    const p = pane(100, 400, 900, 136);
    reveal(p);
    const r = p.tab.getBoundingClientRect();
    expect(r.right).toBeCloseTo(100 + 400 - 28, 5);
  });
  it('shows its start in a row narrower than it', () => {
    const p = pane(100, 60, 500, 88);
    reveal(p);
    expect(p.tab.getBoundingClientRect().left).toBeCloseTo(100, 5);
  });
  it('shows its start where the pinned buttons left the row no width', () => {
    const p = pane(130, 0, 500, 88);
    reveal(p);
    expect(p.tab.getBoundingClientRect().left).toBeCloseTo(130, 5);
  });
});
