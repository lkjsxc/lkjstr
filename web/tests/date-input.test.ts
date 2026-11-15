import { describe, expect, it } from 'vitest';
import { parseDateInput } from '../src/shared/date-input.ts';

const now = new Date(2026, 10, 15, 12);
describe('local date input', () => {
  it.each([
    '2026/11/15',
    '2026-11-15',
    '2026.11.15',
    '20261115',
    '2026年11月15日',
    '２０２６／１１／１５',
    '２０２６－１１－１５',
    '11/15',
    '11月15日',
    '今日',
    'today',
  ])('%s', (s) => {
    expect(parseDateInput(s, 'start', now)).toBe('2026-11-15');
  });
  it.each([
    ['2026/1/5', '2026-01-05', '2026-01-05'],
    ['2026/11', '2026-11-01', '2026-11-30'],
    ['2026年11月', '2026-11-01', '2026-11-30'],
    ['2026', '2026-01-01', '2026-12-31'],
    ['昨日', '2026-11-14', '2026-11-14'],
    ['yesterday', '2026-11-14', '2026-11-14'],
    ['3日前', '2026-11-12', '2026-11-12'],
    ['3d', '2026-11-12', '2026-11-12'],
    ['2週間前', '2026-11-01', '2026-11-01'],
    ['2w', '2026-11-01', '2026-11-01'],
    ['1か月前', '2026-10-15', '2026-10-15'],
    ['1m', '2026-10-15', '2026-10-15'],
    ['1年前', '2025-11-15', '2025-11-15'],
    ['1y', '2025-11-15', '2025-11-15'],
  ])('%s respects period edge', (s, start, end) => {
    expect(parseDateInput(s, 'start', now)).toBe(start);
    expect(parseDateInput(s, 'end', now)).toBe(end);
  });
  it.each(['2/30', '2026/2/29', '2026/13', '2026/0/1', 'abc', '', '2026/11/15garbage'])(
    'rejects %s',
    (s) => {
      expect(parseDateInput(s, 'start', now)).toBeUndefined();
    },
  );
  it('clamps relative months and years to the calendar, without rounding typed dates', () => {
    expect(parseDateInput('1m', 'start', new Date(2026, 2, 31))).toBe('2026-02-28');
    expect(parseDateInput('1y', 'start', new Date(2024, 1, 29))).toBe('2023-02-28');
  });
});
