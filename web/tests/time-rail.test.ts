import { expect, it, vi } from 'vitest';
import { localZone } from '../src/shared/format.ts';
import { openPopover, popoverOpen } from '../src/wm/menus.ts';

import { month, setup } from './time-rail-fixture.ts';

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

it('resets an unsupported answer when the chronological view opens again', () => {
  const x = setup({ supported: false, months: [], positions: [] });
  expect(x.track.hidden).toBe(true);
  x.rail.reset();
  vi.advanceTimersByTime(16);
  expect(x.track.hidden).toBe(false);
});

// Three local days, one note each, in the page's zone; and a fourth, older, whose notes are not loaded.
const day = (i: number) => ({
  at: month - i * 86_400_000,
  month,
  offset: i,
  count: i === 3 ? 97 : 1,
});
const dated = {
  months: [{ at: month, count: 100 }],
  days: [0, 1, 2, 3].map(day),
  zone: localZone(),
};

it('steps a day with ] and [, returns with Backspace, and says each landing once', () => {
  const x = setup(dated);
  const live = x.el.querySelector<HTMLElement>('[aria-live]')!;
  expect(x.key(']').defaultPrevented).toBe(true);
  expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n2', off: 0 });
  expect(live.textContent).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  expect(x.key('[').defaultPrevented).toBe(true);
  expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n1', off: 0 });
  expect(x.key('Backspace').defaultPrevented).toBe(true);
  expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n2', off: -12 }); // exactly where the last jump started
  expect(x.key('Backspace').defaultPrevented).toBe(false); // no tick left
  x.key('['), x.key('[');
  expect(x.set.mock.lastCall?.[0]).toEqual({ key: 'n0', off: 0 });
  expect(x.key('[').defaultPrevented).toBe(false); // the newest day: nothing newer
  const field = document.createElement('input');
  x.el.append(field);
  const typed = new KeyboardEvent('keydown', { key: ']', bubbles: true, cancelable: true });
  field.dispatchEvent(typed);
  expect(typed.defaultPrevented).toBe(false);
});

it('says the day of a target still loading, then admits it after 500ms', () => {
  const x = setup(dated);
  const label = x.el.querySelector<HTMLElement>('.time-rail .scrub')!;
  x.pointer(x.track, 'pointerdown', 190);
  x.pointer(x.track, 'pointerup', 190);
  expect(x.seek).toHaveBeenCalledTimes(1);
  expect(label.hidden).toBe(false);
  expect(label.textContent).toMatch(/^\d{4}\/\d{2}\/\d{2}$/); // never an unknown minute
  vi.advanceTimersByTime(500);
  expect(label.textContent).toMatch(/^\d{4}\/\d{2}\/\d{2}\u2009\u2026$/);
});

it('draws a hover line and label for a fine pointer, and keeps marks still while held', () => {
  const x = setup(dated);
  const line = x.el.querySelector<HTMLElement>('.time-hover')!;
  const label = x.el.querySelector<HTMLElement>('.time-rail .scrub')!;
  x.pointer(x.track, 'pointermove', 20);
  expect(line.hidden).toBe(false);
  expect(label.textContent).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  x.track.dispatchEvent(new PointerEvent('pointerleave'));
  vi.advanceTimersByTime(16);
  expect(line.hidden).toBe(true);
  expect(label.hidden).toBe(true);
  const marks = x.el.querySelector<HTMLElement>('.time-marks')!;
  const lens = x.el.querySelector('.time-lens')!;
  expect(lens.children).toHaveLength(0);
  x.pointer(x.track, 'pointerdown', 20);
  expect(lens.querySelector('.time-month')).not.toBeNull();
  expect(label.hidden).toBe(false);
  const before = marks.innerHTML;
  const old = Date.UTC(2020, 0);
  x.rail.timeline({
    ...{ positions: [], supported: true, newest: month, oldest: old, older: false },
    months: [...dated.months, { at: old, count: 9 }],
    days: [...dated.days, { at: old, month: old, offset: 0, count: 9 }],
    zone: dated.zone,
  });
  vi.advanceTimersByTime(16);
  expect(marks.innerHTML).toBe(before);
  x.pointer(x.track, 'pointerup', 20);
  expect(marks.innerHTML).not.toBe(before);
  expect(lens.children).toHaveLength(0);
});

it('keeps the grip visible at rest, under a held finger and after the jump label fades', () => {
  const x = setup();
  const grip = x.el.querySelector<HTMLElement>('.time-grip')!;
  expect(x.track.hidden || grip.hidden).toBe(false);
  x.pointer(x.track, 'pointerdown', 100, 'touch');
  expect(grip.hidden).toBe(false);
  expect(grip.style.top).toBe('100px');
  expect(x.track.classList.contains('held')).toBe(true);
  x.pointer(x.track, 'pointermove', 2, 'touch');
  expect(grip.style.top).toBe('20px');
  x.pointer(x.track, 'pointerup', 2, 'touch');
  expect(grip.hidden).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(grip.hidden).toBe(false);
  expect(x.track.classList.contains('held')).toBe(false);
});
