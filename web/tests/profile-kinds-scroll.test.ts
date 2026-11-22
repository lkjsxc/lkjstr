import { afterEach, expect, it, vi } from 'vitest';
import type { Row } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import { mountProfileKinds } from '../src/views/profile-kinds.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  setLang('en');
});

function fixture(attached = true) {
  setLang('en');
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  let resize = (): void => {};
  const disconnect = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++serial, fn);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(fn: () => void) {
        resize = fn;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  let header = document.createElement('section');
  if (attached) document.body.append(header);
  const row = { kind: 'profile' } as Row;
  const state = { show: 'all' };
  const env = {
    engine: { info: createSignal({ engine: 'test', version: 3 }) },
  } as unknown as ViewEnv;
  let bar: HTMLElement;
  const buttons = (): void => {
    for (const [i, button] of [...bar.querySelectorAll<HTMLElement>('.pkind')].entries()) {
      Object.defineProperty(button, 'offsetWidth', { configurable: true, value: 70 });
      button.getBoundingClientRect = () => new DOMRect(10 + i * 70 - bar.scrollLeft, 0, 70, 30);
    }
  };
  const kinds = mountProfileKinds({ env, state, save() {}, reopen: buttons });
  kinds.seat(header, row);
  bar = header.querySelector<HTMLElement>('.pkinds')!;
  let left = 0;
  Object.defineProperties(bar, {
    clientWidth: { get: () => (bar.isConnected ? 370 : 0) },
    scrollWidth: { get: () => (bar.isConnected ? 560 : 0) },
    scrollLeft: {
      get: () => left,
      set: (value: number) => {
        left = bar.isConnected ? Math.min(190, Math.max(0, value)) : 0;
      },
    },
  });
  bar.getBoundingClientRect = () => new DOMRect(10, 0, bar.clientWidth, 30);
  buttons();
  const flush = (): void => {
    const pending = [...frames.values()];
    frames.clear();
    for (const fn of pending) fn(0);
  };
  const replace = (): void => {
    header.remove();
    // Chromium resets a nested scroller when its old profile header is removed.
    bar.scrollLeft = 0;
    bar.dispatchEvent(new Event('scroll'));
    header = document.createElement('section');
    document.body.append(header);
    kinds.seat(header, row);
  };
  const scroll = (value: number): void => {
    bar.scrollLeft = value;
    bar.dispatchEvent(new Event('scroll'));
  };
  return {
    bar,
    kinds,
    flush,
    replace,
    scroll,
    disconnect,
    resize: () => resize(),
    attach: () => document.body.append(header),
    hide: () => {
      header.remove();
      bar.scrollLeft = 0;
      bar.dispatchEvent(new Event('scroll'));
    },
  };
}

it('retains an initial selection reveal until a detached bar becomes measurable', () => {
  const f = fixture(false);
  f.flush();
  expect(f.bar.scrollLeft).toBe(0);
  f.attach();
  f.resize();
  f.flush();
  expect(f.bar.scrollLeft).toBe(190);
  f.kinds.dispose();
  expect(f.disconnect).toHaveBeenCalledOnce();
});

it('preserves the revealed position immediately when a profile count replaces its header', () => {
  const f = fixture();
  f.flush();
  expect(f.bar.scrollLeft).toBe(190);
  f.replace();
  expect(f.bar.scrollLeft).toBe(190);
  f.flush();
  expect(f.bar.scrollLeft).toBe(190);
  f.kinds.dispose();
});

it.each([0, 35])(
  'keeps manual scroll %i through arrival redraws, then reveals an explicit selection',
  (left) => {
    const f = fixture();
    f.flush();
    f.scroll(left);
    f.replace();
    f.flush();
    f.resize();
    f.flush();
    expect(f.bar.scrollLeft).toBe(left);
    f.bar.querySelector<HTMLButtonElement>('.pkind')!.click();
    f.flush();
    expect(f.bar.scrollLeft).toBe(0);
    f.bar.querySelector<HTMLButtonElement>('.pkind:last-child')!.click();
    f.flush();
    expect(f.bar.scrollLeft).toBe(190);
    f.kinds.dispose();
  },
);

it('restores horizontal position when returning to an already-seated hidden tab', () => {
  const f = fixture();
  f.flush();
  for (const left of [190, 35, 0]) {
    f.scroll(left);
    f.hide();
    f.resize();
    f.attach();
    f.resize();
    f.flush();
    expect(f.bar.scrollLeft).toBe(left);
  }
  f.kinds.dispose();
});
