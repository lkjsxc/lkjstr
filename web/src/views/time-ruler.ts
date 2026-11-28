// Occupied calendar spans, newest first. Every boundary is a real note ordinal on the rank map.
import type { ClockPart, Day } from './time-parts.ts';
import type { TimeBand, TimePlace } from './time-scale.ts';

export type Level = 'year' | 'month' | 'day' | 'hour' | 'quarter' | 'five';
export type Span = {
  readonly level: Level;
  readonly key: number;
  readonly y: number;
  end: number;
  readonly text: string;
  readonly place: TimePlace;
  readonly children: Span[];
  readonly coarse?: boolean;
  /** How round the boundary is, 0 (:05) to 12 (year); it sets the mark's tone and text size. */
  readonly rank: number;
};

// One ladder of ranks from the faintest five minutes to the year (docs/interface-time.md C2). A boundary that
// is also the next unit's boundary shares its rank: :00 is a plain hour, midnight a plain day, the 1st a plain month.
/** Minutes, ranks 0 to 4: :05, :10, :15 and :45, :30, then :00. */
export const minuteRank = (min: number): number => {
  const round = [60, 30, 15, 10].findIndex((m) => min % m === 0);
  return round < 0 ? 0 : 4 - round;
};
/** Hours, ranks 4 to 7: plain, 06 and 18, 12, then midnight. */
export const hourRank = (hour: number): number =>
  hour === 0 ? 7 : hour === 12 ? 6 : hour % 6 === 0 ? 5 : 4;
/** Days, ranks 7 to 9: plain, the 11th and 21st, then the 1st. */
export const dayRank = (day: number): number => (day === 1 ? 9 : day === 11 || day === 21 ? 8 : 7);
/** Months, ranks 9 to 11: plain, April, July and October, then January. */
export const monthRank = (month: number): number => (month === 1 ? 11 : month % 3 === 1 ? 10 : 9);
export const YEAR_RANK = 12;
/** Share of `--fg` over `--paper`, in percent: rounder boundaries are darker (owner, 2026-11-27). */
export const markTone = (rank: number): number => 50 + 3.5 * rank;
/**
 * Label text size in px: rounder boundaries are also larger, 9px to 12px (owner, 2026-11-28). The largest stays
 * inside the 12px label line, and a January `mm/dd` inside the 36px column left of the ticks.
 */
export const markSize = (rank: number): number => 9 + 0.25 * rank;

const pad = (n: number): string => String(n).padStart(2, '0');
const minute = 60_000;
const clockText = (hour: number, min: number): string => `${pad(hour)}:${pad(min)}`;

export function rulerSpans(
  bands: readonly TimeBand[],
  days?: readonly Day[],
  clock: readonly ClockPart[] = [],
): Span[] {
  const years: Span[] = [];
  const byMonth = new Map(bands.map((b) => [b.at, b]));
  const covered = new Map<number, number>();
  let iClock = 0;

  // A local period can have consecutive parts in two UTC bands. Merge them by calendar key.
  const append = (
    list: Span[],
    level: Level,
    key: number,
    text: string,
    rank: number,
    band: TimeBand,
    offset: number,
    count: number,
    coarse = false,
  ): Span => {
    const end = band.y + (band.h * (offset + count)) / band.count;
    const previous = list.at(-1);
    if (previous?.key === key) {
      previous.end = end;
      return previous;
    }
    const y = band.y + (band.h * offset) / band.count;
    const span = {
      level,
      key,
      text,
      y,
      end,
      place: { month: band.at, offset },
      children: [],
      coarse,
      rank,
    };
    list.push(span);
    return span;
  };

  for (const part of days ?? []) {
    const band = byMonth.get(part.month);
    if (!band) continue;
    const { offset, count } = part;
    covered.set(band.at, offset + count);
    const date = new Date(part.at);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateText = `${pad(month)}/${pad(day)}`;
    const annual = append(years, 'year', year, String(year), YEAR_RANK, band, offset, count);
    const monthly = append(
      annual.children,
      'month',
      month,
      dateText,
      monthRank(month),
      band,
      offset,
      count,
    );
    const daily = append(
      monthly.children,
      'day',
      part.at,
      dateText,
      dayRank(day),
      band,
      offset,
      count,
    );
    for (let bucket = clock[iClock]; bucket; bucket = clock[iClock]) {
      const [at, utcMonth, start, notes] = bucket;
      if (utcMonth !== band.at || start >= offset + count) break;
      iClock++;
      const date = new Date(at);
      const hour = date.getHours();
      const min = date.getMinutes();
      const quarter = min - (min % 15);
      const text = clockText(hour, min);
      // Use the absolute instant as the key, preserving both occurrences of a repeated hour.
      const hours = append(
        daily.children,
        'hour',
        at - min * minute,
        text,
        hourRank(hour),
        band,
        start,
        notes,
      );
      const quarters = append(
        hours.children,
        'quarter',
        at - (min - quarter) * minute,
        text,
        minuteRank(quarter),
        band,
        start,
        notes,
      );
      append(quarters.children, 'five', at, text, minuteRank(min), band, start, notes);
    }
  }
  for (const band of bands) {
    const offset = covered.get(band.at) ?? 0;
    const count = band.count - offset;
    if (!count) continue;
    const date = new Date(band.at);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const annual = append(years, 'year', year, String(year), YEAR_RANK, band, offset, count);
    append(
      annual.children,
      'month',
      month,
      pad(month),
      monthRank(month),
      band,
      offset,
      count,
      true,
    );
  }
  return years;
}
