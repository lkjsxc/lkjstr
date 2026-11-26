// Owner report 2026-11-26: the rail showed nothing, and the grip stuck to the top after scrolling down.
import { expect, it, vi } from 'vitest';
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
