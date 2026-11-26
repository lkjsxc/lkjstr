import { afterEach, expect, it } from 'vitest';
import { lensMarks, planMarks, snap } from '../src/views/time-marks.ts';
import { timePreview } from '../src/views/time-preview.ts';
import { rulerSpans, type Span } from '../src/views/time-ruler.ts';
import { timeScale } from '../src/views/time-scale.ts';

const zone = process.env.TZ;
const inZone = (tz: string): void => void (process.env.TZ = tz);
afterEach(() => void (process.env.TZ = zone));

const H = 3_600_000;
const D = 24 * H;
const M = 60_000;
const newer = (at: number, i: number) => ({ kind: 'dm' as const, key: String(i), at });
const shape = (times: readonly number[]) => timePreview(times.map(newer), Infinity);
const children = (spans: readonly Span[]): Span[] => spans.flatMap((s) => s.children);
const from = (times: readonly number[], height: number, wide = true) => {
  const { months, days, clock } = shape(times);
  const years = rulerSpans(timeScale(months, height), days, clock);
  return planMarks(years, height, wide);
};

it('puts the local new year above its older UTC month and merges a local day across two bands', () => {
  inZone('Asia/Tokyo');
  const late = Date.UTC(2026, 11, 31, 16); // 2027/01/01 01:00 JST, still the UTC December
  const { months, days, clock } = shape([
    Date.UTC(2027, 0, 1, 5),
    late,
    Date.UTC(2026, 11, 31, 10),
    Date.UTC(2026, 11, 30, 10),
  ]);
  const bands = timeScale(months, 600);
  const years = rulerSpans(bands, days, clock);
  const firstDay = children(children(years))[0]!;
  expect(years.map((s) => s.text)).toEqual(['2027', '2026']);
  expect(firstDay).toMatchObject({ text: '01', y: 0 });
  expect(firstDay.children.map((h) => h.text)).toEqual(['14:00', '01:00']);
  expect(firstDay.children[1]?.place).toEqual({ month: Date.UTC(2026, 11, 1), offset: 0 });
  expect(firstDay.end).toBeGreaterThan(bands[1]!.y);
});

it('keeps the two occurrences of the repeated local hour in a fall-back day', () => {
  inZone('America/New_York');
  const { months, days, clock } = shape([
    Date.UTC(2026, 10, 1, 6, 42), // EST
    Date.UTC(2026, 10, 1, 5, 42), // EDT
  ]);
  const years = rulerSpans(timeScale(months, 600), days, clock);
  const daily = children(children(years));
  expect(daily).toHaveLength(1);
  const hours = children(daily);
  expect(hours.map((h) => h.text)).toEqual(['01:40', '01:40']);
  expect(hours[0]!.key - hours[1]!.key).toBe(H);
});

it('recurses through a dense local day to hours, quarters and five-minute marks if the pixels allow', () => {
  inZone('UTC');
  // One week within one year and month. Nearly all notes are in today's two busiest hours.
  const start = Date.UTC(2026, 10, 20, 20, 59);
  const busy = Array.from({ length: 120 }, (_, i) => start - i * M);
  const sparse = Array.from({ length: 6 }, (_, i) => start - (i + 1) * D);
  const plan = from([...busy, ...sparse], 800);
  const levels = new Set(plan.labels.map((l) => l.level));
  expect(levels).toEqual(new Set(['year', 'month', 'day', 'hour', 'quarter', 'five']));
  expect(plan.labels.filter((l) => l.major).map((l) => l.text)).toEqual(['2026']);
  expect(plan.labels.filter((l) => l.level === 'five').every((l) => l.y < 760)).toBe(true);
  const clockLabels = plan.labels.map((l) => l.text).filter((text) => /^\d\d:\d\d$/.test(text));
  expect(clockLabels).toEqual([...new Set(clockLabels)].sort().reverse());
  for (let i = 1; i < plan.labels.length; i++)
    expect(plan.labels[i]!.centre - plan.labels[i - 1]!.centre).toBeGreaterThanOrEqual(14);
  for (let i = 1; i < plan.dots.length; i++) {
    const [a, b] = [plan.dots[i - 1]!, plan.dots[i]!];
    expect(b.y - a.y).toBeGreaterThanOrEqual((a.size + b.size) / 2 + 2);
  }
  expect(from([...busy, ...sparse], 70).labels.some((l) => l.level === 'five')).toBe(false);
});

it('offers one more unit around the held grip without moving resting labels', () => {
  inZone('UTC');
  const start = Date.UTC(2026, 10, 20, 20, 59);
  const times = Array.from({ length: 360 }, (_, i) => start - i * M);
  const plan = from(times, 230);
  const around = lensMarks(plan, 110, 230);
  expect(around.length).toBeGreaterThan(0);
  expect(around.every((l) => Math.abs(l.centre - 110) <= 48)).toBe(true);
  expect(
    around.every((l) => plan.frontier.some((s) => s.key === l.key && s.level === l.level)),
  ).toBe(true);
  for (const l of around) expect(plan.labels).not.toContainEqual(l);
});

it('shows only years and month ticks at rest on a narrow rail', () => {
  inZone('UTC');
  const start = Date.UTC(2026, 10, 2, 12);
  const plan = from([start, start - 3 * D], 800, false);
  expect(plan.labels.map((l) => l.text)).toEqual(['2026']);
  expect(plan.dots).toHaveLength(2);
  expect(lensMarks(plan, 40, 800).map((l) => l.level)).toEqual(['month']);
});

it('preserves sparse archive years without showing UTC fallback months as local labels', () => {
  inZone('UTC');
  const start = Date.UTC(2026, 10, 20);
  const times = [
    ...Array.from({ length: 300 }, (_, i) => start - i * H),
    ...Array.from({ length: 36 }, (_, i) => Date.UTC(2025, 9 - i, 15)),
  ];
  const { months, days, clock } = shape(times);
  const recent = days.filter((d) => d.at >= Date.UTC(2026, 10, 1));
  const plan = planMarks(rulerSpans(timeScale(months, 800), recent, clock), 800, true);
  const labels = plan.labels.map((l) => l.text);
  for (const year of ['2025', '2024', '2023']) expect(labels).toContain(year);
  expect(plan.labels.some((l) => l.coarse)).toBe(false);
  expect(plan.dots.length).toBeGreaterThan(plan.labels.length);
});

it('uses a label centre for snap, and bounds the planning time for a long retained history', () => {
  const now = Date.UTC(2026, 10, 20);
  const times = Array.from({ length: 4000 }, (_, i) => now - Math.floor(i / 10) * D - (i % 10) * H);
  const { months, days, clock } = shape(times);
  const bands = timeScale(months, 900);
  const begin = performance.now();
  for (let i = 0; i < 20; i++) planMarks(rulerSpans(bands, days, clock), 900, true);
  expect((performance.now() - begin) / 20).toBeLessThan(12);
  const label = planMarks(rulerSpans(bands, days, clock), 900, true).labels[3]!;
  expect(snap([label], label.centre + 6)?.place).toEqual(label.place);
  expect(snap([label], label.centre + 7)).toBeUndefined();
});
