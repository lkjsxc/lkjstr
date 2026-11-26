// Owner report 2026-11-26: the rail showed nothing, and the grip stuck to the top after scrolling down.
import { expect, it, vi } from 'vitest';
import { timeText } from '../src/views/feed-scrub.ts';
import { month, setup } from './time-rail-fixture.ts';

it('keeps the grip beside an uncounted top row instead of at the top', () => {
  // Older history or live notes arrived while the engine rebuilds its count: the top row has no position yet.
  const x = setup({
    positions: [
      { key: 'n0', month, offset: 0 },
      { key: 'n2', month, offset: 2 },
    ],
  });
  const grip = x.el.querySelector<HTMLElement>('.time-grip')!;
  // n2, the nearest counted row below, stands in: two thirds down the 184px map.
  expect(Number.parseFloat(grip.style.top)).toBeCloseTo(8 + (2 / 3) * 184);
});

it('is never empty while its room is reserved and nothing is counted yet', () => {
  const x = setup({ months: [], positions: [] });
  const grip = x.el.querySelector<HTMLElement>('.time-grip')!;
  expect(x.track.hidden).toBe(false);
  expect(x.track.classList.contains('plain')).toBe(true);
  expect(x.el.classList.contains('has-time-rail')).toBe(true);
  expect(grip.style.top).toBe('16px');
  x.el.scrollTop = 200;
  x.el.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(16);
  expect(Number.parseFloat(grip.style.top)).toBeCloseTo(8 + 92);
  // A drag scrolls by share, with no seek: there is no count to seek in.
  x.pointer(x.track, 'pointerdown', 8 + 184);
  x.pointer(x.track, 'pointerup', 8 + 184);
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
  x.pointer(x.track, 'pointermove', 8 + 184);
  expect.soft(x.track.classList.contains('plain')).toBe(true);
  expect.soft(x.el.scrollTop).toBe(400);
  expect.soft(label.hidden).toBe(false);
  expect.soft(label.textContent).toBe(timeText(month + 1));
  x.pointer(x.track, 'pointerup', 8 + 184);
  expect(x.track.classList.contains('plain')).toBe(false);
  expect(x.seek).not.toHaveBeenCalled();
});
