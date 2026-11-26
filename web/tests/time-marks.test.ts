// The rail's marks (docs/interface-time.md C2): local boundaries, the placement rule and the press snap.
import { afterEach, describe, expect, it } from 'vitest';
import { localDay } from '../src/shared/format.ts';
import { boundaries, type Day, planMarks, snap } from '../src/views/time-marks.ts';
import { noteToPlace, timeScale } from '../src/views/time-scale.ts';

const zone = process.env.TZ;
const inZone = (tz: string): void => void (process.env.TZ = tz);
afterEach(() => void (process.env.TZ = zone));

/** Months and local days for note times given newest first, counted as the engine counts them. */
function counted(times: readonly number[]) {
  const months = new Map<number, number>();
  const days: Day[] = [];
  for (const t of times) {
    const d = new Date(t);
    const month = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const offset = months.get(month) ?? 0;
    months.set(month, offset + 1);
    const at = localDay(t);
    const last = days.at(-1);
    if (last?.at === at && last.month === month)
      days[days.length - 1] = { ...last, count: last.count + 1 };
    else days.push({ at, month, offset, count: 1 });
  }
  return { months: [...months].map(([at, count]) => ({ at, count })), days };
}
const H = 3_600_000;
const D = 24 * H;

describe('local boundaries', () => {
  it('names the newest days above a sparse old tail past the day bound, and only years in the tail', () => {
    inZone('UTC');
    // Ten busy recent days, then one old post a month for three years: the engine names only the recent days.
    const recent = Array.from({ length: 300 }, (_, i) => Date.UTC(2026, 10, 25, 20) - i * 0.8 * H);
    const old = Array.from({ length: 36 }, (_, i) => Date.UTC(2025, 9 - i, 15));
    const { months, days } = counted([...recent, ...old]);
    const cut = days.filter((d) => d.at >= Date.UTC(2026, 10, 1)); // as if past the bound
    const bands = timeScale(months, 800);
    const all = boundaries(bands, cut);
    const { labels, dots } = planMarks(all, 800, true);
    const named = labels.map((l) => l.text);
    expect(named.slice(0, 3)).toEqual(['2026', '11/25', '24']);
    expect(named.filter((t) => /^\d\d$/.test(t)).length).toBeGreaterThanOrEqual(6);
    for (const year of ['2025', '2024', '2023']) expect(named).toContain(year);
    // Tail months are dots, never a label claiming a day nobody counted.
    expect(labels.filter((l) => l.coarse)).toEqual([]);
    expect(dots.length).toBeGreaterThan(named.length);
    // The recent days hold most of the rail.
    const lastDay = all.filter((b) => b.level === 'day').at(-1)?.y ?? 0;
    expect(lastDay).toBeGreaterThan(0.75 * 800);
  });

  it('puts a JST new year at its first local day, above a UTC December note', () => {
    inZone('Asia/Tokyo');
    const late = Date.UTC(2026, 11, 31, 16); // 2027/01/01 01:00 JST, still the UTC December
    const times = [
      Date.UTC(2027, 0, 1, 5),
      late,
      Date.UTC(2026, 11, 31, 10),
      Date.UTC(2026, 11, 30, 10),
    ];
    const { months, days } = counted(times);
    const bands = timeScale(months, 600);
    const all = boundaries(bands, days);
    const y2027 = all.find((b) => b.level === 'year' && b.year === 2027);
    expect(y2027).toMatchObject({ month: 1, day: 1, y: 0 });
    const lateY = noteToPlace(bands, { month: Date.UTC(2026, 11, 1), offset: 0 });
    expect(lateY).toBeGreaterThan(y2027?.y ?? Infinity);
    expect(bands[1]?.at).toBe(Date.UTC(2026, 11, 1)); // the note stays in its UTC band
    expect(all.filter((b) => b.level === 'day').map((b) => b.day)).toEqual([1, 31, 30]);
    expect(all.find((b) => b.level === 'year' && b.year === 2026)?.day).toBe(31);
  });

  it('gives one mark per local day across the end of daylight time in New York', () => {
    inZone('America/New_York');
    const times = [
      Date.UTC(2026, 10, 2, 6), // 11/02 01:00 EST
      Date.UTC(2026, 10, 2, 4, 30), // 11/01 23:30 EST
      Date.UTC(2026, 10, 1, 4, 30), // 11/01 00:30 EDT
      Date.UTC(2026, 9, 31, 14), // 10/31 10:00 EDT
    ];
    const { months, days } = counted(times);
    expect(days.map((d) => d.at)).toEqual([
      Date.UTC(2026, 10, 2, 5),
      Date.UTC(2026, 10, 1, 4),
      Date.UTC(2026, 9, 31, 4),
    ]);
    const all = boundaries(timeScale(months, 600), days);
    expect(all.filter((b) => b.level === 'day').map((b) => `${b.month}/${b.day}`)).toEqual([
      '11/2',
      '11/1',
      '10/31',
    ]);
    expect(all.filter((b) => b.level === 'month').map((b) => b.month)).toEqual([11, 10]);
  });

  it('falls back to UTC month bands, naming only years', () => {
    const months = [Date.UTC(2026, 1), Date.UTC(2026, 0), Date.UTC(2025, 11)].map((at) => ({
      at,
      count: 2,
    }));
    const all = boundaries(timeScale(months, 300));
    expect(all.map((b) => `${b.level}:${b.year}/${b.month}`)).toEqual([
      'year:2026/2',
      'month:2026/2',
      'month:2026/1',
      'year:2025/12',
      'month:2025/12',
    ]);
    const { labels, dots } = planMarks(all, 300, true);
    expect(labels.map((l) => l.text)).toEqual(['2026', '2025']);
    expect(dots).toHaveLength(3);
  });
});

describe('placement', () => {
  inZone(zone ?? 'UTC');
  const tenDays = () => {
    inZone('Asia/Tokyo');
    // Ten local days across 11/01, three notes each, in 2026.
    const times = Array.from(
      { length: 30 },
      (_, i) => Date.UTC(2026, 10, 5, 3) - Math.floor(i / 3) * D - (i % 3) * H,
    );
    return counted(times);
  };

  it('names ten days across a month start at 1440: the month as mm/dd, the newest under its year', () => {
    const { months, days } = tenDays();
    const all = boundaries(timeScale(months, 800), days);
    const { labels } = planMarks(all, 800, true);
    const texts = labels.map((l) => l.text);
    expect(texts).toEqual([
      '2026',
      '11/05',
      '04',
      '03',
      '02',
      '01',
      '10/31',
      '30',
      '29',
      '28',
      '27',
    ]);
    for (let i = 1; i < labels.length; i++)
      expect(labels[i]!.centre - labels[i - 1]!.centre).toBeGreaterThanOrEqual(14);
  });

  it('keeps the oldest year, then newer years, months and days; dots 2px apart', () => {
    const { months, days } = counted(
      Array.from({ length: 700 }, (_, i) => Date.UTC(2026, 10, 20, 12) - i * 2 * D),
    );
    const all = boundaries(timeScale(months, 500), days);
    const { labels, dots } = planMarks(all, 500, true);
    const years = all.filter((b) => b.level === 'year').map((b) => String(b.year));
    expect(labels.some((l) => l.text === years.at(-1))).toBe(true);
    for (let i = 1; i < labels.length; i++)
      expect(labels[i]!.centre - labels[i - 1]!.centre).toBeGreaterThanOrEqual(14);
    for (let i = 1; i < dots.length; i++) {
      const [a, b] = [dots[i - 1]!, dots[i]!];
      expect(b.y - a.y).toBeGreaterThanOrEqual((a.size + b.size) / 2 + 2);
    }
    for (const l of labels)
      expect(l.centre).toBeGreaterThanOrEqual(6), expect(l.centre).toBeLessThanOrEqual(494);
    // A month or a day loses its label to a year standing within 14px, never the other way round.
    for (const y of all.filter((b) => b.level === 'year'))
      if (!labels.some((l) => l.level === 'year' && l.year === y.year))
        expect(labels.some((l) => l.level === 'year' && Math.abs(l.centre - (y.y + 6)) < 14)).toBe(
          true,
        );
  });

  it('names only years on a narrow rail, with no day dots', () => {
    const { months, days } = tenDays();
    const { labels, dots } = planMarks(boundaries(timeScale(months, 800), days), 800, false);
    expect(labels.map((l) => l.text)).toEqual(['2026']);
    expect(dots.every((d) => d.size === 3)).toBe(true);
    expect(dots).toHaveLength(2); // the year (11/05) and the month that began on 10/31
  });

  it('snaps a press within 6px of a label to its period', () => {
    const { months, days } = tenDays();
    const { labels } = planMarks(boundaries(timeScale(months, 800), days), 800, true);
    const l = labels[3]!;
    expect(snap(labels, l.centre + 6)?.place).toEqual(l.place);
    expect(snap(labels, l.centre + 6.5)).toBeUndefined();
  });

  it('plans 400 days and 120 months in well under a frame', () => {
    const times = Array.from(
      { length: 4000 },
      (_, i) => Date.UTC(2026, 10, 20) - Math.floor(i / 10) * D,
    );
    const { months, days } = counted(times);
    const old = Array.from({ length: 107 }, (_, i) => ({
      at: Date.UTC(2015, 11 - i, 1),
      count: 5,
    }));
    const bands = timeScale([...months, ...old], 900);
    const start = performance.now();
    for (let i = 0; i < 20; i++) planMarks(boundaries(bands, days), 900, true);
    expect((performance.now() - start) / 20).toBeLessThan(4); // 1ms in the browser bench; a test host is slower
  });
});
