import { afterEach, expect, it, vi } from 'vitest';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import { loadViewState, saveViewState } from '../src/shared/view-state.ts';
import { type BaseEnv, createOwnViews, type OwnViews } from '../src/wm/own-views.ts';
import { LKJSXC, LKJSXC_HOME } from '../src/wm/presets.ts';

let own: OwnViews;
let resize: () => void;
function setup(scroll: object) {
  setLang('en');
  saveViewState('test:docs', { page: 'privacy', scroll });
  function observeResize(callback: () => void) {
    resize = callback;
    return { observe() {}, disconnect() {} };
  }
  vi.stubGlobal('ResizeObserver', observeResize);
  own = createOwnViews(
    { engine: { info: createSignal(null) } } as unknown as BaseEnv,
    'test',
    () => {
      throw new Error('unexpected launcher');
    },
    () => {},
    () => () => {},
    () => {},
  );
  const el = own.el('docs')!;
  document.body.append(el);
  own.sync(new Set(['docs']));
  return el;
}
const dimensions = (el: HTMLElement) =>
  Object.defineProperties(el, {
    scrollHeight: { value: 2000 },
    clientHeight: { value: 200 },
    scrollWidth: { value: 1000 },
    clientWidth: { value: 200 },
  });
afterEach(() => {
  own?.dispose();
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('restores Docs on mount, but mutations and resizes do not undo a page reset before scroll fires', async () => {
  const el = setup({ self: { top: 300, left: 0 } });
  dimensions(el);
  resize();
  expect(el.scrollTop).toBe(300);
  own.stash();
  el.remove();
  el.scrollTop = 0; // A detached view may temporarily lose its scroll range.
  document.body.append(el);
  own.sync(new Set(['docs']));
  resize();
  expect(el.scrollTop).toBe(300);
  el.scrollTop = 450;
  el.dispatchEvent(new Event('scroll'));
  expect(loadViewState('test:docs')).toMatchObject({ scroll: { self: { top: 450 } } });
  el.querySelector<HTMLButtonElement>('[data-page="keys"]')!.click();
  expect(el.scrollTop).toBe(0);
  // Mutation observers run before the browser's queued scroll event.
  await new Promise((done) => setTimeout(done, 0));
  expect(el.scrollTop).toBe(0);
  resize();
  expect(el.scrollTop).toBe(0);
  el.dispatchEvent(new Event('scroll'));
  expect(loadViewState('test:docs')).toMatchObject({ scroll: { self: { top: 0 } } });
  own.stash();
  el.remove();
  document.body.append(el);
  own.sync(new Set(['docs']));
  resize();
  expect(el.scrollTop).toBe(0);
});

it('waits for delayed scrollers, restores replacement nodes and then respects their own scroll changes', async () => {
  const el = setup({ '.sbox': { top: 180, left: 90 } });
  resize(); // The nested scroller has not been hydrated yet.
  const box = document.createElement('div');
  box.className = 'sbox';
  dimensions(box);
  el.append(box);
  await vi.waitFor(() => expect([box.scrollTop, box.scrollLeft]).toEqual([180, 90]));
  box.scrollTop = 0;
  box.scrollLeft = 0;
  box.append(document.createElement('p'));
  resize();
  await new Promise((done) => setTimeout(done, 0));
  expect([box.scrollTop, box.scrollLeft]).toEqual([0, 0]);
  const replacement = box.cloneNode() as HTMLElement;
  dimensions(replacement);
  box.replaceWith(replacement);
  await vi.waitFor(() =>
    expect([replacement.scrollTop, replacement.scrollLeft]).toEqual([180, 90]),
  );
});

it('restores vertical and horizontal positions independently as their scroll ranges become available', async () => {
  const el = setup({ self: { top: 180, left: 90 } });
  let width = 200;
  Object.defineProperties(el, {
    scrollHeight: { value: 2000 },
    clientHeight: { value: 200 },
    scrollWidth: { get: () => width },
    clientWidth: { value: 200 },
  });
  resize();
  expect([el.scrollTop, el.scrollLeft]).toEqual([180, 0]);
  el.scrollTop = 0;
  width = 1000;
  el.append(document.createElement('p'));
  await vi.waitFor(() => expect([el.scrollTop, el.scrollLeft]).toEqual([0, 90]));
});

it("names and fills the default's tab of lkjsxc's Home before it is drawn, and never over what it holds", () => {
  setup({});
  expect(own.title(LKJSXC_HOME)).toBe("lkjsxc's Home");
  expect(loadViewState(`test:${LKJSXC_HOME}`)).toEqual({ pubkey: LKJSXC, title: "lkjsxc's Home" });
  // Only that id: a Their Home the reader opened names its own person.
  expect(own.title('their-home')).toBe('Their Home');
  expect(loadViewState('test:their-home')).toEqual({});
  // What the tab already holds (a reading place, a newer title) stays.
  own.drop(LKJSXC_HOME);
  saveViewState(`test:${LKJSXC_HOME}`, { pubkey: LKJSXC, title: 'kept', scroll: { self: 9 } });
  expect(own.title(LKJSXC_HOME)).toBe('kept');
  expect(loadViewState(`test:${LKJSXC_HOME}`)).toMatchObject({
    title: 'kept',
    scroll: { self: 9 },
  });
});
