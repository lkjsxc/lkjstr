// The top bar's tab search hangs under its button, right edges together, kept inside the window at any width; the
// same field opened by its key stays over the tile. The account menu hangs from the face the same way.
import { afterEach, expect, it, vi } from 'vitest';
import { createTopBar } from '../src/ui/topbar.ts';
import { openTabSearch, type TabFinder } from '../src/wm/tab-search.ts';
import { account, PUBKEY, vaultEnv } from './vault-ui-fixture.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
});

const boxes = new Map<Element, DOMRect>();
/** Gives an element a box on screen (happy-dom lays nothing out). */
const box = (el: Element, x: number, y: number, w: number, hgt: number): void =>
  void boxes.set(el, new DOMRect(x, y, w, hgt));
/** Every popover drawn from now on is `w` by `hgt`. */
const popovers = (w: number, hgt: number): void => {
  boxes.clear();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.matches('.tsearch, .menu')) return new DOMRect(0, 0, w, hgt);
    return boxes.get(this) ?? new DOMRect();
  });
};

function finder(tile: HTMLElement): TabFinder {
  return { anchor: () => tile, tabs: () => [], show() {}, open() {}, front: () => undefined };
}

it.each([
  [1440, 1350],
  [390, 300],
])('opens tab search under the top bar button at %ipx', (width, buttonLeft) => {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', 800);
  const layer = document.body.appendChild(document.createElement('div'));
  const button = document.body.appendChild(document.createElement('button'));
  const tile = document.body.appendChild(document.createElement('div'));
  popovers(340, 300);
  box(layer, 0, 0, width, 800);
  box(button, buttonLeft, 5, 28, 28);
  box(tile, 0, 38, width / 2, 400);
  openTabSearch(layer, finder(tile), button);
  const el = layer.querySelector<HTMLElement>('.tsearch')!;
  expect(Number.parseFloat(el.style.left)).toBe(Math.max(4, buttonLeft + 28 - 340));
  expect(Number.parseFloat(el.style.top)).toBe(35);
  openTabSearch(layer, finder(tile), button); // the button again closes it
  expect(layer.querySelector('.tsearch')).toBeNull();
  // Its key opens it over the tile, at the tile's left.
  openTabSearch(layer, finder(tile));
  expect(layer.querySelector<HTMLElement>('.tsearch')!.style.left).toBe('4px');
  vi.unstubAllGlobals();
});

it('passes its own button to tab search and hangs the account menu from the face', () => {
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 800);
  const x = vaultEnv({});
  x.accounts.set({ active: PUBKEY, accounts: [account({})] });
  const search = vi.fn();
  const bar = createTopBar(x.el, {
    engine: x.env.engine,
    settings: x.env.settings,
    layer: x.env.layer,
    spaces: document.createElement('div'),
    search,
    open: x.open,
  });
  try {
    const button = x.el.querySelector<HTMLElement>('[data-tab-search]')!;
    button.click();
    expect(search).toHaveBeenCalledWith(button);
    const face = x.el.querySelector<HTMLElement>('.acct')!;
    popovers(220, 120);
    box(x.env.layer, 0, 0, 390, 800);
    box(face, 340, 0, 38, 38);
    face.click();
    const menu = x.env.layer.querySelector<HTMLElement>('.menu')!;
    expect(Number.parseFloat(menu.style.left)).toBe(340 + 38 - 220);
  } finally {
    bar.dispose();
    x.dispose();
    vi.unstubAllGlobals();
  }
});
