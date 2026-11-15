import { describe, expect, it } from 'vitest';
import {
  monthOf,
  noteToPlace,
  placeToNote,
  timeMarks,
  timeScale,
} from '../src/views/time-scale.ts';

const months = (counts: number[]) =>
  counts.map((count, i) => ({ at: Date.UTC(2026, 10 - i, 1), count }));
describe('compressive month map', () => {
  for (const counts of [[10000, 1, 1, 1], [9], Array.from({ length: 400 }, () => 3)]) {
    it(`is monotonic and round trips ${counts.length} months`, () => {
      const bands = timeScale(months(counts), 600);
      expect(bands.reduce((s, b) => s + b.h, 0)).toBeCloseTo(600);
      let previous = -1;
      for (const b of bands)
        for (let offset = 0; offset < b.count; offset++) {
          const place = { month: b.at, offset };
          const y = noteToPlace(bands, place);
          expect(y).toBeGreaterThan(previous);
          expect(placeToNote(bands, y)).toEqual(place);
          previous = y;
        }
      expect(placeToNote(bands, 600)).toEqual({
        month: bands.at(-1)?.at,
        offset: (counts.at(-1) ?? 1) - 1,
      });
    });
  }
  it('gives a quiet month space beside ten thousand notes', () => {
    const b = timeScale(months([10000, 1, 1]), 600);
    expect(b[1]?.h).toBeGreaterThan(4);
    expect(b[0]?.h).toBeLessThan((600 * 10000) / 10002);
  });
  it('ignores empty months, clamps future dates, retains epoch zero', () => {
    expect(timeScale(months([0, 2, 0]), 100)).toHaveLength(1);
    expect(timeScale([], 100)).toEqual([]);
    expect(monthOf(0)).toBe(0);
    expect(monthOf(Date.UTC(2099, 0), Date.UTC(2026, 10, 15))).toBe(Date.UTC(2026, 10));
  });
});
describe('marks', () => {
  it('keeps the oldest number and gives numbers priority over dots', () => {
    const b = timeScale(months(Array.from({ length: 40 }, () => 1)), 70);
    const marks = timeMarks(b, 70);
    expect(marks.some((m) => m.year === 2023)).toBe(true);
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1]!;
      const c = marks[i]!;
      expect(c.y - a.y).toBeGreaterThanOrEqual((a.year ? 6 : 1.5) + (c.year ? 6 : 1.5) + 2);
    }
  });
  it('keeps the newer number when ordinary numbers collide', () => {
    const b = [
      { at: Date.UTC(2026, 0), count: 1, y: 0, h: 5 },
      { at: Date.UTC(2025, 0), count: 1, y: 5, h: 40 },
      { at: 0, count: 1, y: 45, h: 15 },
    ];
    expect(
      timeMarks(b, 60)
        .filter((m) => m.year)
        .map((m) => m.year),
    ).toEqual([2026, 1970]);
    expect(timeMarks(timeScale(months([4]), 100), 100)).toEqual([]);
  });
});
