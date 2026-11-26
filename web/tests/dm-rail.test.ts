import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createListKeeper, type DmRailRow, dmTimeline } from '../src/views/dm-rail.ts';
import { mountTimeRail } from '../src/views/time-rail.ts';

const box = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 560, width: 560 }) as DOMRect;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

it('builds monotonic newest-first months, local days and positions for DM rows', () => {
  const now = Date.UTC(2026, 10, 26, 12, 0);
  const rows: DmRailRow[] = [
    { kind: 'dm', key: 'm1', at: Date.UTC(2026, 10, 25, 10, 0) },
    { kind: 'dm', key: 'm2', at: Date.UTC(2026, 10, 20, 8, 0) },
    { kind: 'dm', key: 'm3', at: Date.UTC(2026, 8, 5, 9, 0) },
    { kind: 'dm', key: 'm4', at: Date.UTC(2025, 0, 15, 12, 0) },
  ];
  const tl = dmTimeline(rows, true, now);
  expect(tl.supported).toBe(true);
  expect(tl.older).toBe(true);
  expect(tl.months).toEqual([
    { at: Date.UTC(2026, 10, 1), count: 2 },
    { at: Date.UTC(2026, 8, 1), count: 1 },
    { at: Date.UTC(2025, 0, 1), count: 1 },
  ]);
  expect(tl.positions).toEqual([
    { key: 'm1', month: Date.UTC(2026, 10, 1), offset: 0, at: rows[0]?.at },
    { key: 'm2', month: Date.UTC(2026, 10, 1), offset: 1, at: rows[1]?.at },
    { key: 'm3', month: Date.UTC(2026, 8, 1), offset: 0, at: rows[2]?.at },
    { key: 'm4', month: Date.UTC(2025, 0, 1), offset: 0, at: rows[3]?.at },
  ]);
  expect(tl.days?.length).toBe(4);
});

it('mounts an unmounted DM row on jump and restores the original row via the return tick', () => {
  const pane = document.createElement('div');
  pane.className = 'pane cur';
  const el = document.createElement('div');
  el.dataset.kind = 'message';
  const list = document.createElement('div');
  const tail = document.createElement('div');
  const n0 = document.createElement('div');
  n0.dataset.key = 'm0';
  const nOld = document.createElement('div');
  nOld.dataset.key = 'mOld';
  list.append(n0);
  el.append(list, tail);
  pane.append(el);
  document.body.append(pane);
  Object.defineProperty(el, 'clientHeight', { value: 216, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: 1200, configurable: true });
  el.getBoundingClientRect = () => box(0, 216);
  n0.getBoundingClientRect = () => box(-10, 60);
  nOld.getBoundingClientRect = () => box(900, 60);
  const rows: DmRailRow[] = [
    { kind: 'dm', key: 'm0', at: Date.UTC(2026, 10, 25, 10, 0) },
    { kind: 'dm', key: 'mOld', at: Date.UTC(2025, 0, 15, 12, 0) },
  ];
  const ensured: string[] = [];
  const keeper = createListKeeper(el, list, tail);
  const set = vi.spyOn(keeper, 'set');
  const rail = mountTimeRail({
    candidate: () => true,
    version: () => 8,
    el,
    list,
    tail,
    keeper,
    rows: () => rows,
    ensure(key) {
      ensured.push(key);
      if (key === 'mOld' && !nOld.isConnected) list.append(nOld);
    },
    seek: () => rail.window(),
    active: () => true,
  });
  rail.timeline(dmTimeline(rows, false, Date.UTC(2026, 10, 26, 12, 0)));
  vi.advanceTimersByTime(16);
  const track = el.querySelector<HTMLElement>('.time-rail')!;
  expect(track.hidden).toBe(false);
  const end = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
  window.dispatchEvent(end);
  expect(end.defaultPrevented).toBe(true);
  expect(ensured).toEqual(['mOld']);
  expect(set.mock.lastCall?.[0]).toEqual({ key: 'mOld', off: 0 });
  const back = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
  window.dispatchEvent(back);
  expect(back.defaultPrevented).toBe(true);
  expect(set.mock.lastCall?.[0]).toEqual({ key: 'm0', off: -10 });
  rail.dispose();
});
