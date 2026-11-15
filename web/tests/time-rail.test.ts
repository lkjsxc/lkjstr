import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Row } from '../src/engine/protocol.ts';
import type { Keeper } from '../src/views/feed-place.ts';
import { mountTimeRail } from '../src/views/time-rail.ts';
import { openPopover, popoverOpen } from '../src/wm/menus.ts';

const month = Date.UTC(2026, 10);
let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup() {
  const el = document.createElement('div');
  const list = document.createElement('div');
  const tail = document.createElement('div');
  el.append(list, tail);
  document.body.append(el);
  Object.defineProperties(el, {
    clientHeight: { value: 200 },
    scrollHeight: { value: 600 },
    offsetWidth: { value: 600 },
  });
  el.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  let top = 1;
  const rows = [0, 1, 2].map((i) => ({ kind: 'note', key: `n${i}`, at: month + i })) as Row[];
  for (const [i, row] of rows.entries()) {
    const node = document.createElement('div');
    node.dataset.key = row.key;
    node.getBoundingClientRect = () =>
      ({ top: (i - top) * 200 - 12, bottom: (i - top + 1) * 200 - 12 }) as DOMRect;
    list.append(node);
  }
  const set = vi.fn(({ key }: { key: string }) => {
    top = rows.findIndex((r) => r.key === key);
  });
  const seek = vi.fn();
  const rail = mountTimeRail({
    candidate: true,
    version: () => 5,
    el,
    list,
    tail,
    keeper: { set } as unknown as Keeper,
    rows: () => rows,
    seek,
    active: () => true,
  });
  dispose = rail.dispose;
  rail.timeline({
    supported: true,
    months: [{ at: month, count: 3 }],
    positions: rows.map((r, offset) => ({ key: r.key, month, offset })),
    newest: month,
    oldest: month,
    older: false,
  });
  vi.advanceTimersByTime(16);
  const track = el.querySelector<HTMLElement>('.time-rail')!;
  track.setPointerCapture = vi.fn();
  const tick = el.querySelector<HTMLElement>('.time-return')!;
  const pointer = (target: HTMLElement, type: string, y: number) => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientY: y }),
    );
    vi.advanceTimersByTime(100);
  };
  const key = (name: string) => {
    const e = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    vi.advanceTimersByTime(16);
    return e;
  };
  return { el, track, tick, pointer, key, set, seek };
}

it.each(['click', 'drag'])(
  'returns to the original row and offset after a loaded rail %s',
  (mode) => {
    const x = setup();
    x.pointer(x.track, 'pointerdown', mode === 'drag' ? 10 : 190);
    if (mode === 'drag') x.pointer(x.track, 'pointermove', 190);
    x.pointer(x.track, 'pointerup', 190);
    expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n2', off: 0 });
    expect(x.tick.hidden).toBe(false);
    x.pointer(x.tick, 'pointerdown', 100);
    expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n1', off: -12 });
    expect(x.tick.hidden).toBe(true);
    expect(x.seek).not.toHaveBeenCalled();
  },
);

it.each(['Home', 'End'])('leaves a return tick for loaded %s navigation', (key) => {
  const x = setup();
  expect(x.key(key).defaultPrevented).toBe(true);
  expect(x.set.mock.lastCall?.[0]).toEqual({ key: key === 'Home' ? 'n0' : 'n2', off: 0 });
  expect(x.tick.hidden).toBe(false);
  x.pointer(x.tick, 'pointerdown', 100);
  expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n1', off: -12 });
  expect(x.tick.hidden).toBe(true);
});

it('leaves Home and End with an open button-based popover, then resumes after close', () => {
  const x = setup();
  const panel = document.createElement('div');
  const button = document.createElement('button');
  panel.append(button);
  const close = openPopover(document.body, x.el, panel);
  button.focus();
  for (const key of ['Home', 'End']) {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    button.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(popoverOpen()).toBe(true);
  }
  expect(x.set).not.toHaveBeenCalled();
  expect(x.seek).not.toHaveBeenCalled();
  close();
  expect(x.key('End').defaultPrevented).toBe(true);
  expect(x.set).toHaveBeenCalled();
});
