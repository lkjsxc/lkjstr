import { expect, it } from 'vitest';
import type { Timeline } from '../src/engine/protocol.ts';
import { localZone } from '../src/shared/format.ts';
import { dmTimeline } from '../src/views/dm-rail.ts';
import { createMarkPainter, createTimeRailNodes } from '../src/views/time-draw.ts';
import { snap } from '../src/views/time-marks.ts';
import { timePreview } from '../src/views/time-preview.ts';
import { markSize, markTone, monthRank, YEAR_RANK } from '../src/views/time-ruler.ts';
import { timeScale } from '../src/views/time-scale.ts';

// Local dates, far from midnight so the fixture does not depend on the runner's UTC offset.
const rows = [
  new Date(2026, 10, 29, 16),
  new Date(2026, 10, 28, 14),
  new Date(2026, 10, 28, 13, 30),
  new Date(2026, 10, 27, 12),
  new Date(2026, 2, 6, 12),
  new Date(2026, 2, 5, 12),
].map((date, i) => ({ kind: 'dm' as const, key: String(i), at: date.getTime() }));
const shape = timePreview(rows, Infinity);
const texts = (root: HTMLElement, selector: string) =>
  [...root.querySelectorAll(selector)].map((el) => el.textContent);
const setup = (
  height: number,
  wide: boolean,
  data: Pick<Timeline, 'months' | 'days' | 'clock'> = shape,
) => {
  const { marks, lens } = createTimeRailNodes(document.createElement('div'));
  const painter = createMarkPainter(marks, lens);
  const labels = painter.draw(
    timeScale(data.months, height),
    data,
    height,
    wide,
    localZone(),
    true,
  );
  return { marks, lens, painter, labels };
};
const centres = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('.time-label')].map((el) =>
    Number.parseFloat(el.style.top),
  );
const spaced = (root: HTMLElement, height: number) => {
  const ys = centres(root).sort((a, b) => a - b);
  expect(
    ys.every((y, i) => y >= 6 && y <= height - 6 && (i === 0 || y - ys[i - 1]! >= 14 - 1e-6)),
  ).toBe(true);
};

it.each([
  ['provisional', shape],
  ['DM', dmTimeline(rows, false, Infinity)],
] as const)('draws zero-padded local month and day marks on a wide %s rail', (_, data) => {
  const { marks, labels } = setup(800, true, data);
  expect(texts(marks, '.time-day')).toEqual(['11/28', '11/27', '03/05']);
  expect(texts(marks, '.time-month')).toEqual(['11/29', '03/06']);
  expect(texts(marks, '.time-label').filter((text) => text === '11/29')).toHaveLength(1);
  const month = labels.find((l) => l.text === '11/29')!;
  expect(month.level).toBe('month');
  expect(month.rank).toBe(monthRank(11));
  // The drawn label carries both looks of its rank; a year is the largest and a clock label the smallest.
  const drawn = (text: string) =>
    [...marks.querySelectorAll<HTMLElement>('.time-label')].find((el) => el.textContent === text)!;
  const size = (text: string) => Number.parseFloat(drawn(text).style.getPropertyValue('--size'));
  expect(drawn('11/29').style.getPropertyValue('--tone')).toBe(`${markTone(month.rank)}%`);
  expect(size('11/29')).toBe(markSize(month.rank));
  expect(size('2026')).toBe(markSize(YEAR_RANK));
  expect(size('2026')).toBeGreaterThan(size('11/29'));
  expect(size('11/29')).toBeGreaterThan(size('11/28'));
  expect(size('11/28')).toBeGreaterThan(size('16:00'));
  expect(snap(labels, month.centre)?.place).toEqual(month.place);
  // The suppressed month-head day is not a leaf: its first hour is still reachable.
  expect(labels.find((l) => l.text === '16:00')).toMatchObject({
    level: 'hour',
    place: month.place,
  });
  expect(texts(marks, '.time-hour')).toContain('16:00');
  spaced(marks, 800);
});

it('draws the same MM/DD text in a wide rail lens when a day cannot fit at rest', () => {
  const { marks, lens, painter } = setup(70, true);
  expect(texts(marks, '.time-day')).toEqual([]);
  for (const [y, text] of [
    [30, '11/28'],
    [20, '03/05'],
  ] as const) {
    painter.lens(y, 70);
    expect(texts(lens, '.time-day')).toContain(text);
    // The held lens draws the same rank-sized labels as the resting column.
    for (const el of lens.querySelectorAll<HTMLElement>('.time-label'))
      expect(Number.parseFloat(el.style.getPropertyValue('--size'))).toBeGreaterThanOrEqual(9);
    expect(texts(lens, '.time-label')).not.toContain('11/29');
    spaced(lens, 70);
    expect(centres(lens).every((centre) => Math.abs(centre - y) >= 20)).toBe(true);
  }
  painter.lens(undefined, 70);
  expect(lens.children).toHaveLength(0);
});

it('keeps a narrow rail at years and reveals its month-head dates in the held lens', () => {
  const { marks, lens, painter } = setup(160, false);
  expect(texts(marks, '.time-label')).toEqual(['2026']);
  painter.lens(80, 160);
  expect(texts(lens, '.time-label')).toEqual(['11/29', '03/06']);
  spaced(marks, 160);
  spaced(lens, 160);
  expect(centres(lens).every((centre) => Math.abs(centre - 80) >= 20)).toBe(true);
});
