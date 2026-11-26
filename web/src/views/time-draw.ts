// Drawing the rail's marks from a plan (docs/interface-time.md C2), apart from its input and seeks.
import { h } from '../shared/h.ts';
import { centred } from './feed-scrub.ts';
import { boundaries, type Day, type Label, planMarks } from './time-marks.ts';
import type { TimeBand } from './time-scale.ts';

export function createTimeRailNodes(el: HTMLElement) {
  const rail = h('div', { class: 'time-rail', hidden: true, 'aria-hidden': 'true' });
  const marks = h('div', { class: 'time-marks' });
  const grip = h('div', { class: 'time-grip' });
  const hoverLine = h('div', { class: 'time-hover', hidden: true });
  const tick = h('div', { class: 'time-return', hidden: true });
  const label = h('div', { class: 'scrub', hidden: true });
  const live = h('div', { class: 'vh', 'aria-live': 'polite' });
  rail.append(marks, hoverLine, grip, tick, label);
  const pin = h('div', { class: 'time-pin' }, rail, live);
  el.prepend(pin);
  return { rail, marks, grip, hoverLine, tick, label, live, pin };
}

export const loadingText = (time: string, waiting: boolean): string =>
  waiting ? (time ? `${time} …` : '…') : time;

export function drawLabel(label: HTMLElement, text: string, y: number, height: number): void {
  label.hidden = !text;
  if (!text) return;
  label.textContent = text;
  label.style.top = `${centred(label, y, height)}px`;
}

export function drawCurrentYear(marks: HTMLElement, at: number, local: boolean): void {
  const date = new Date(at);
  const year = String(local ? date.getFullYear() : date.getUTCFullYear());
  for (const number of marks.querySelectorAll('.time-year'))
    number.classList.toggle('current', number.textContent === year);
}

/** Replaces the marks and returns the labels a press can snap to. */
export function drawMarks(
  marks: HTMLElement,
  bands: readonly TimeBand[],
  days: readonly Day[] | undefined,
  height: number,
  wide: boolean,
  hours?: readonly Day[],
): readonly Label[] {
  const plan = planMarks(boundaries(bands, days, hours), height, wide);
  const top = (y: number): string => `top: ${y + 8}px`;
  marks.replaceChildren(
    ...plan.dots.map((d) =>
      h('span', { class: d.size === 2 ? 'time-dot fine' : 'time-dot', style: top(d.y) }),
    ),
    ...plan.labels.map((l) =>
      h('span', { class: `time-label time-${l.level}`, style: top(l.centre) }, l.text),
    ),
  );
  return plan.labels;
}

/** Where the grip stands for a list the engine has not counted yet: the share of the list scrolled. */
export const scrolledY = (el: HTMLElement, height: number): number =>
  (el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)) * height;

/** Scrolls an uncounted list to `share` (0 to 1) of the way down. */
export const scrollShare = (el: HTMLElement, share: number): void =>
  void (el.scrollTop = share * (el.scrollHeight - el.clientHeight));
