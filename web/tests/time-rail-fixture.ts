// The shared rail fixture: a 200px list of three 200px notes in one month, the top one half scrolled away.
import { afterEach, beforeEach, vi } from 'vitest';
import type { Row, Timeline } from '../src/engine/protocol.ts';
import type { Keeper } from '../src/views/feed-place.ts';
import { mountTimeRail } from '../src/views/time-rail.ts';

export const month = Date.UTC(2026, 10);
let dispose: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
export function setup(
  extra: Partial<Timeline> | null = {},
  { scrollHeight = 600, rowsReady = true } = {},
) {
  const el = document.createElement('div');
  const list = document.createElement('div');
  const tail = document.createElement('div');
  el.append(list, tail);
  document.body.append(el);
  Object.defineProperties(el, {
    clientHeight: { value: 200 },
    scrollHeight: { value: scrollHeight },
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
    key: (kind) => kind,
    el,
    list,
    tail,
    keeper: { set } as unknown as Keeper,
    rows: () => (rowsReady ? rows : []),
    seek,
    active: () => true,
  });
  dispose = rail.dispose;
  if (extra)
    rail.timeline({
      supported: true,
      months: [{ at: month, count: 3 }],
      positions: rows.map((r, offset) => ({ key: r.key, month, offset })),
      newest: month,
      oldest: month,
      older: false,
      ...extra,
    });
  vi.advanceTimersByTime(16);
  const track = el.querySelector<HTMLElement>('.time-rail')!;
  track.setPointerCapture = vi.fn();
  const tick = el.querySelector<HTMLElement>('.time-return')!;
  const pointer = (target: HTMLElement, type: string, y: number, pointerType = 'mouse') => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientY: y, pointerType }),
    );
    vi.advanceTimersByTime(100);
  };
  const key = (name: string) => {
    const e = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    vi.advanceTimersByTime(16);
    return e;
  };
  const showRows = () => {
    rowsReady = true;
    rail.rowsChanged();
  };
  return { el, rail, track, tick, pointer, key, set, seek, showRows };
}
