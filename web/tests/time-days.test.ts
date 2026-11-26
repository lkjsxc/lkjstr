// Finding a place's local day, the label's day text, and the keyboard's day and month steps (interface-time.md C3).
import { describe, expect, it } from 'vitest';
import { dayText, partOf, railDays, stepDay, stepMonth } from '../src/views/time-days.ts';
import type { Day } from '../src/views/time-parts.ts';
import { timeScale } from '../src/views/time-scale.ts';

const nov = Date.UTC(2026, 10);
const oct = Date.UTC(2026, 9);
const H = 3_600_000;
// JST days, newest first: 11/20; 11/01 across the UTC month (two parts); 10/31.
const days: Day[] = [
  { at: Date.UTC(2026, 10, 19, 15), month: nov, offset: 0, count: 2 },
  { at: Date.UTC(2026, 9, 31, 15), month: nov, offset: 2, count: 1 },
  { at: Date.UTC(2026, 9, 31, 15), month: oct, offset: 0, count: 3 },
  { at: Date.UTC(2026, 9, 30, 15), month: oct, offset: 3, count: 1 },
];

describe('days on the rail', () => {
  it('counts only days in the page zone', () => {
    expect(railDays({ days, zone: 'Asia/Tokyo' }, 'Asia/Tokyo')).toBe(days);
    expect(railDays({ days, zone: 'UTC' }, 'Asia/Tokyo')).toBeUndefined();
    expect(railDays({ zone: 'Asia/Tokyo' }, 'Asia/Tokyo')).toBeUndefined();
  });

  it('finds the part of a place, and its day as yyyy/mm/dd', () => {
    expect(partOf(days, { month: nov, offset: 1 })).toBe(0);
    expect(partOf(days, { month: oct, offset: 2 })).toBe(2);
    expect(partOf(days, { month: oct, offset: 9 })).toBe(-1);
    process.env.TZ = 'Asia/Tokyo';
    expect(dayText(days, { month: oct, offset: 1 })).toBe('2026/11/01');
    expect(dayText(undefined, { month: oct, offset: 1 })).toBe('');
  });

  it('steps one occupied day, to its newest note; nothing at the ends', () => {
    const from = { month: nov, offset: 1 }; // 11/20
    const older = stepDay(days, from, 1);
    expect(older).toEqual({ month: nov, offset: 2 }); // 11/01, its newer part
    expect(stepDay(days, { month: oct, offset: 2 }, 1)).toEqual({ month: oct, offset: 3 });
    expect(stepDay(days, { month: oct, offset: 2 }, -1)).toEqual({ month: nov, offset: 0 });
    expect(stepDay(days, older!, -1)).toEqual({ month: nov, offset: 0 }); // and back
    expect(stepDay(days, { month: oct, offset: 3 }, 1)).toBeUndefined();
    expect(stepDay(days, { month: nov, offset: 0 }, -1)).toBeUndefined();
    expect(Date.UTC(2026, 9, 31, 15) - days[3]!.at).toBe(24 * H);
  });

  it('steps one occupied month without days', () => {
    const bands = timeScale(
      [nov, oct, Date.UTC(2026, 6)].map((at) => ({ at, count: 4 })),
      300,
    );
    expect(stepMonth(bands, { month: oct, offset: 3 }, 1)).toEqual({
      month: Date.UTC(2026, 6),
      offset: 0,
    });
    expect(stepMonth(bands, { month: oct, offset: 3 }, -1)).toEqual({ month: nov, offset: 0 });
    expect(stepMonth(bands, { month: nov, offset: 0 }, -1)).toBeUndefined();
  });
});
