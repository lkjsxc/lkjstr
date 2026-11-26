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
};

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
    const annual = append(years, 'year', year, String(year), band, offset, count);
    const monthly = append(
      annual.children,
      'month',
      month,
      `${pad(month)}/${pad(day)}`,
      band,
      offset,
      count,
    );
    const daily = append(monthly.children, 'day', part.at, pad(day), band, offset, count);
    for (let bucket = clock[iClock]; bucket; bucket = clock[iClock]) {
      const [at, utcMonth, start, notes] = bucket;
      if (utcMonth !== band.at || start >= offset + count) break;
      iClock++;
      const date = new Date(at);
      const hour = date.getHours();
      const min = date.getMinutes();
      const quarter = min - (min % 15);
      // Use the absolute instant as the key, preserving both occurrences of a repeated hour.
      const hours = append(
        daily.children,
        'hour',
        at - min * minute,
        clockText(hour, 0),
        band,
        start,
        notes,
      );
      const quarters = append(
        hours.children,
        'quarter',
        at - (min - quarter) * minute,
        clockText(hour, quarter),
        band,
        start,
        notes,
      );
      append(quarters.children, 'five', at, clockText(hour, min), band, start, notes);
    }
  }
  for (const band of bands) {
    const offset = covered.get(band.at) ?? 0;
    const count = band.count - offset;
    if (!count) continue;
    const date = new Date(band.at);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const annual = append(years, 'year', year, String(year), band, offset, count);
    append(annual.children, 'month', month, pad(month), band, offset, count, true);
  }
  return years;
}
