// Drawing the rail's marks from a plan (docs/interface-time.md C2), apart from its input and seeks.
import { h } from '../shared/h.ts';
import { centred } from './feed-scrub.ts';
import { type Label, lensMarks, type MarkPlan, planMarks } from './time-marks.ts';
import type { ClockPart, Day } from './time-parts.ts';
import { rulerSpans } from './time-ruler.ts';
import type { TimeBand } from './time-scale.ts';

export function createTimeRailNodes(el: HTMLElement) {
  const rail = h('div', { class: 'time-rail', hidden: true, 'aria-hidden': 'true' });
  const marks = h('div', { class: 'time-marks' });
  const lens = h('div', { class: 'time-lens' });
  const grip = h('div', { class: 'time-grip' }, h('div', { class: 'time-grip-target' }));
  const hoverLine = h('div', { class: 'time-hover', hidden: true });
  const tick = h('div', { class: 'time-return', hidden: true });
  const label = h('div', { class: 'scrub', hidden: true });
  const live = h('div', { class: 'vh', 'aria-live': 'polite' });
  rail.append(marks, lens, hoverLine, grip, tick, label);
  const pin = h('div', { class: 'time-pin' }, rail, live);
  el.prepend(pin);
  return { rail, marks, lens, grip, hoverLine, tick, label, live, pin };
}

// The 32px grip has 4px of breathing room at both ends of a normal tile.
export function fitTimeRail(rail: HTMLElement, view: number) {
  const inset = Math.min(20, Math.max(0, (view - 1) / 2));
  rail.style.height = `${view}px`;
  rail.style.setProperty('--time-inset', `${inset}px`);
  return { inset, height: Math.max(1, view - 2 * inset) };
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

// `--tone` is the span's share of `--fg` over `--paper` (docs/interface-time.md C2).
const top = (y: number, tone: number): string => `top: ${y}px; --tone: ${tone}%`;
const labelNode = (l: Label): HTMLElement =>
  h(
    'span',
    {
      class: `time-label time-${l.level} ${l.major ? 'time-major' : 'time-minor'}`,
      style: top(l.centre, l.tone),
    },
    l.text,
  );

export function createMarkPainter(marks: HTMLElement, lens: HTMLElement) {
  let plan: MarkPlan = { labels: [], dots: [], frontier: [] };
  let source: unknown;
  let key = '';
  let lensKey = '';
  return {
    draw(
      bands: readonly TimeBand[],
      shape: { days?: readonly Day[]; clock?: readonly ClockPart[] } | undefined,
      height: number,
      wide: boolean,
      zone: string,
      calendar: boolean,
    ) {
      const next = `${height}:${wide}:${zone}:${calendar}`;
      if (source !== shape || key !== next) {
        [source, key] = [shape, next];
        plan = planMarks(
          rulerSpans(
            bands,
            calendar ? shape?.days : undefined,
            calendar ? shape?.clock : undefined,
          ),
          height,
          wide,
        );
        marks.replaceChildren(
          ...plan.dots.map((d) =>
            h('span', {
              class: d.size === 2 ? 'time-dot fine' : 'time-dot',
              style: top(d.y, d.tone),
            }),
          ),
          ...plan.labels.map(labelNode),
        );
      }
      return plan.labels;
    },
    lens(y: number | undefined, height: number) {
      const labels = y === undefined ? [] : lensMarks(plan, y, height);
      const key = labels.map((l) => `${l.level}:${l.text}:${l.centre}`).join('|');
      if (key === lensKey) return;
      lensKey = key;
      lens.replaceChildren(...labels.map(labelNode));
    },
  };
}

/** Where the grip stands for a list the engine has not counted yet: the share of the list scrolled. */
export const scrolledY = (el: HTMLElement, height: number): number =>
  (el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)) * height;

/** Scrolls an uncounted list to `share` (0 to 1) of the way down. */
export const scrollShare = (el: HTMLElement, share: number): void =>
  void (el.scrollTop = share * (el.scrollHeight - el.clientHeight));
