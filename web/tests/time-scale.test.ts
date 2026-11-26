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
    expect(b[1]?.h).toBeGreaterThanOrEqual(3);
    expect(b[0]?.h).toBeLessThan((600 * 10000) / 10002);
  });
  it('keeps dense recent weeks readable above a sparse old tail', () => {
    // A Home: busy recent months, then the reader's own few posts over three years.
    const counts = [3000, 800, ...Array.from({ length: 36 }, (_, i) => 1 + (i % 3))];
    const b = timeScale(months(counts), 800);
    const recent = (b[0]?.h ?? 0) + (b[1]?.h ?? 0);
    expect(recent).toBeGreaterThan(0.88 * 800);
    // Every tail month is still reachable, and together they take at most a tenth and their notes' share.
    const tail = b.slice(2);
    expect(Math.min(...tail.map((t) => t.h))).toBeGreaterThan(1);
    expect(tail.reduce((s, t) => s + t.h, 0)).toBeLessThan(0.1 * 800 + 800 * (72 / 3872));
    // Within the dense part, one note is about as tall as any other: the scale is by rank, not by month.
    expect((b[0]?.h ?? 0) / 3000 / ((b[1]?.h ?? 0) / 800)).toBeCloseTo(1, 1);
  });
  it('ignores empty months, clamps future dates, retains epoch zero', () => {
    expect(timeScale(months([0, 2, 0]), 100)).toHaveLength(1);
    expect(timeScale([], 100)).toEqual([]);
    expect(monthOf(0)).toBe(0);
    expect(monthOf(Date.UTC(2099, 0), Date.UTC(2026, 10, 15))).toBe(Date.UTC(2026, 10));
  });
});
