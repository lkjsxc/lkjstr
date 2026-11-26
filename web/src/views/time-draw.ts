// Drawing the rail's marks from a plan (docs/interface-time.md C2), apart from its input and seeks.
import { h } from '../shared/h.ts';
import { boundaries, type Day, type Label, planMarks } from './time-marks.ts';
import type { TimeBand } from './time-scale.ts';

/** Replaces the marks and returns the labels a press can snap to. */
export function drawMarks(
  marks: HTMLElement,
  bands: readonly TimeBand[],
  days: readonly Day[] | undefined,
  height: number,
  wide: boolean,
): readonly Label[] {
  const plan = planMarks(boundaries(bands, days), height, wide);
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
