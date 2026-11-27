// Owner report 2026-11-26: the rail showed nothing, and the grip stuck to the top after scrolling down.
import { expect, it, vi } from 'vitest';
import { timeText } from '../src/views/feed-scrub.ts';
import { month, setup } from './time-rail-fixture.ts';

it('paints the grip with the first rows before a timeline or local overflow', () => {
  const x = setup(null, { rowsReady: false, scrollHeight: 200 });
  expect(x.track.hidden).toBe(false);
  expect(x.track.classList.contains('empty')).toBe(true);
  expect(x.track.querySelector<HTMLElement>('.time-grip')?.hidden).toBe(true);
  x.showRows();
  expect(x.track.classList.contains('empty')).toBe(false);
  expect(x.track.querySelector<HTMLElement>('.time-grip')?.hidden).toBe(false);
  expect(x.track.hidden).toBe(false);
  expect(x.track.classList.contains('plain')).toBe(true);
  expect(x.track.querySelector<HTMLElement>('.time-grip')?.style.top).toBe('20px');
  expect(x.track.querySelector('.time-marks .time-year')).not.toBeNull();
  expect(x.track.querySelector<HTMLElement>('.scrub')?.hidden).toBe(true);
});

it('keeps provisional marks and grip visible after scroll and touch labels time out', () => {
  const x = setup(null);
  const label = x.track.querySelector<HTMLElement>('.scrub')!;
  const grip = x.track.querySelector<HTMLElement>('.time-grip')!;
  x.el.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(16);
  expect(label.hidden).toBe(true);
  x.el.dispatchEvent(new WheelEvent('wheel'));
  x.el.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(990);
  expect(label.hidden).toBe(false);
  expect(label.textContent).toBe(timeText(month + 1));
  vi.advanceTimersByTime(30);
  expect(label.hidden).toBe(true);
  x.el.dispatchEvent(new Event('touchstart'));
  vi.advanceTimersByTime(16);
  expect(label.hidden).toBe(false);
  vi.advanceTimersByTime(1020);
  expect(label.hidden).toBe(true);
  expect(x.track.hidden || grip.hidden).toBe(false);
  expect(x.track.querySelector('.time-year')).not.toBeNull();
});

it('keeps the plain grip when a header overflows before dated rows arrive', () => {
  const x = setup({ months: [], positions: [] }, { rowsReady: false });
  expect(x.track.hidden).toBe(false);
  expect(x.track.classList.contains('plain')).toBe(true);
});

it('paints the first grip at the restored share and keeps it there without a counted position', () => {
  const x = setup({ positions: [] }, { rowsReady: false });
  expect(x.track.hidden).toBe(false); // The header already overflows.
  x.el.scrollTop = 200;
  x.showRows();
  expect(x.track.hidden).toBe(false);
  expect(x.track.querySelector<HTMLElement>('.time-grip')?.style.top).toBe('100px');
});

it('keeps the grip beside an uncounted top row instead of at the top', () => {
  // Older history or live notes arrived while the engine rebuilds its count: the top row has no position yet.
  const x = setup({
    positions: [
      { key: 'n0', month, offset: 0 },
      { key: 'n2', month, offset: 2 },
    ],
  });
  const grip = x.el.querySelector<HTMLElement>('.time-grip')!;
  // n2, the nearest counted row below, stands in: two thirds down the 160px map.
  expect(Number.parseFloat(grip.style.top)).toBeCloseTo(20 + (2 / 3) * 160);
});

it('is never empty while its room is reserved and nothing is counted yet', () => {
  const x = setup({ months: [], positions: [] });
  const grip = x.el.querySelector<HTMLElement>('.time-grip')!;
  expect(x.track.hidden).toBe(false);
  expect(x.track.classList.contains('plain')).toBe(true);
  expect(x.el.classList.contains('has-time-rail')).toBe(true);
  expect(grip.style.top).toBe('20px');
  x.el.scrollTop = 200;
  x.el.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(16);
  expect(Number.parseFloat(grip.style.top)).toBeCloseTo(100);
  // A drag scrolls by share, with no seek: there is no count to seek in.
  x.pointer(x.track, 'pointerdown', 180);
  x.pointer(x.track, 'pointerup', 180);
  expect(x.el.scrollTop).toBe(400);
  expect(x.seek).not.toHaveBeenCalled();
  expect(x.set).not.toHaveBeenCalled();
});

it('keeps a plain drag and its reading time when the first count arrives', () => {
  const x = setup({ months: [], positions: [] });
  const label = x.track.querySelector<HTMLElement>('.scrub')!;
  x.pointer(x.track, 'pointerdown', 100);
  expect.soft(label.hidden).toBe(false);
  expect.soft(label.textContent).toBe(timeText(month + 1));
  x.rail.timeline({
    supported: true,
    months: [{ at: month, count: 3 }],
    positions: [{ key: 'n1', month, offset: 1, at: month + 1 }],
    newest: month,
    oldest: month,
    older: false,
  });
  vi.advanceTimersByTime(16);
  x.pointer(x.track, 'pointermove', 180);
  expect.soft(x.track.classList.contains('plain')).toBe(true);
  expect.soft(x.el.scrollTop).toBe(400);
  expect.soft(label.hidden).toBe(false);
  expect.soft(label.textContent).toBe(timeText(month + 1));
  x.pointer(x.track, 'pointerup', 180);
  expect(x.track.classList.contains('plain')).toBe(false);
  expect(x.seek).not.toHaveBeenCalled();
});

it('shows a loaded-row rail when an incomplete cache cannot give a full rank map', () => {
  const recovery = setup({ supported: false, months: [], positions: [] });
  expect(recovery.track.hidden).toBe(false);
  expect(recovery.track.classList.contains('plain')).toBe(true);
  expect(recovery.track.querySelector('.time-year')).not.toBeNull();
  recovery.pointer(recovery.track, 'pointerdown', 200);
  recovery.pointer(recovery.track, 'pointerup', 200);
  expect(recovery.el.scrollTop).toBe(400);
  expect(recovery.seek).not.toHaveBeenCalled();
});
