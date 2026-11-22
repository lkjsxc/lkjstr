import { describe, expect, it } from 'vitest';
import { monthOf, noteToPlace, placeToNote, timeScale } from '../src/views/time-scale.ts';

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
