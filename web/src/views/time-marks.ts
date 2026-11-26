// The rail's marks (docs/interface-time.md C2): where years, months and days begin, and which of their labels and dots
// fit. Pure and tested, so it can move to the engine later without changing what is drawn.
//
// A period's mark sits at its newest note: reading newest first, that is where the period begins as the reader
// scrolls down. A year's newest month is named one line under the year, so the top of a year reads `2026` then
// `11/05`. With the engine's local days, years and months are found from the days; without them, from the UTC month
// bands, and only years are named.
import type { Timeline } from '../engine/protocol.ts';
import { noteToPlace, type TimeBand, type TimePlace } from './time-scale.ts';

export type Day = NonNullable<Timeline['days']>[number];
export type Level = 'year' | 'month' | 'day' | 'hour';
export type Boundary = {
  readonly level: Level;
  /** Px from the top of the rail's map. */
  readonly y: number;
  /** The period's newest note: where a press on its label goes. */
  readonly place: TimePlace;
  readonly year: number;
  readonly month: number; // 1 to 12
  readonly day: number; // 1 to 31
  readonly hour?: number;
  /** A year's newest month: its label stands one line under the year's. */
  readonly stacked?: boolean;
  /** A UTC month past the engine's days (a sparse old tail): a dot, never a label, since its day is not known. */
  readonly coarse?: boolean;
};
export type Label = Boundary & { readonly centre: number; readonly text: string };
export type Dot = { readonly y: number; readonly size: 2 | 3 };

const LABEL = 12; // a label's line box
const LABEL_GAP = 14; // between two labels' centres
const DOT_GAP = 2; // between two dots' edges
const SNAP = 6; // a press this near a label's centre goes to its period
const pad = (n: number): string => String(n).padStart(2, '0');

/** The boundaries, newest first. `days` must already be in the page's zone (`railDays`). */
export function boundaries(
  bands: readonly TimeBand[],
  days?: readonly Day[],
  hours?: readonly Day[],
): Boundary[] {
  const out: Boundary[] = [];
  if (days?.length) {
    let last: Date | undefined;
    for (const part of days) {
      const d = new Date(part.at);
      if (last && d.getTime() === last.getTime()) continue; // the older part of a day across a UTC month
      const place = { month: part.month, offset: part.offset };
      const at = {
        y: noteToPlace(bands, place),
        place,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      };
      if (last?.getFullYear() !== at.year)
        out.push({ ...at, level: 'year' }, { ...at, level: 'month', stacked: true });
      else if (last.getMonth() + 1 !== at.month) out.push({ ...at, level: 'month' });
      out.push({ ...at, level: 'day' });
      last = d;
    }
    // The engine names the newest 400 occupied days; older months are marked by their UTC month bands.
    const end = days.at(-1)?.month ?? 0;
    const fine = hours?.map((part): Boundary => {
      const d = new Date(part.at);
      return {
        level: 'hour',
        y: noteToPlace(bands, part),
        place: part,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
      };
    });
    return out.concat(
      fine ?? [],
      monthMarks(
        bands.filter((b) => b.at < end),
        last?.getFullYear(),
        true,
      ),
    );
  }
  return monthMarks(bands, undefined, false);
}

function monthMarks(bands: readonly TimeBand[], after: number | undefined, coarse: boolean) {
  const out: Boundary[] = [];
  let lastYear = after ?? Number.NaN;
  for (const b of bands) {
    const d = new Date(b.at);
    const at = {
      y: b.y,
      place: { month: b.at, offset: 0 },
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: 1,
    };
    if (at.year !== lastYear) out.push({ ...at, level: 'year' });
    out.push({ ...at, level: 'month', stacked: at.year !== lastYear, coarse });
    lastYear = at.year;
  }
  return out;
}

/** Labels (oldest year first, then years, months and days, newest first; each 14px from the others) and dots (in the
 * same order, 2px apart). A narrow rail names only years and has no day dots, and without local days only years are
 * named. Month labels say `mm/dd` once any day is named, so a month's label reads as the date it stands at. */
export function planMarks(
  all: readonly Boundary[],
  height: number,
  wide: boolean,
): { labels: Label[]; dots: Dot[] } {
  if (all.length < 2) return { labels: [], dots: [] };
  const shown = all.filter((b) => wide || b.level === 'year' || b.level === 'month');
  const years = shown.filter((b) => b.level === 'year');
  const oldest = years.at(-1);
  const order = [
    ...(oldest ? [oldest] : []),
    ...years.slice(0, -1),
    ...shown.filter((b) => b.level === 'month'),
    ...shown.filter((b) => b.level === 'day'),
    ...shown.filter((b) => b.level === 'hour'),
  ];
  const local = all.some((b) => b.level === 'day');
  const labels: Label[] = [];
  for (const b of order) {
    if (!(wide && local) && b.level !== 'year') break;
    if (b.coarse) continue;
    const base = Math.max(0, Math.min(height - LABEL, b.y)) + LABEL / 2;
    const centre = Math.min(height - LABEL / 2, base + (b.stacked ? LABEL_GAP : 0));
    if (labels.every((l) => Math.abs(l.centre - centre) >= LABEL_GAP))
      labels.push({ ...b, centre, text: '' });
  }
  const dated = labels.some((l) => l.level === 'day');
  const text = (b: Boundary): string =>
    b.level === 'year'
      ? String(b.year)
      : b.level === 'day'
        ? pad(b.day)
        : b.level === 'hour'
          ? `${pad(b.hour ?? 0)}:00`
          : dated
            ? `${pad(b.month)}/${pad(b.day)}`
            : pad(b.month);
  const dots: Dot[] = [];
  for (const b of order) {
    const size = b.level === 'day' || b.level === 'hour' ? 2 : 3;
    if (dots.every((d) => Math.abs(d.y - b.y) >= (d.size + size) / 2 + DOT_GAP))
      dots.push({ y: b.y, size });
  }
  return {
    labels: labels.map((l) => ({ ...l, text: text(l) })).sort((a, b) => a.centre - b.centre),
    dots: dots.sort((a, b) => a.y - b.y),
  };
}

/** The label a press at `y` snaps to, if one is near enough. */
export const snap = (labels: readonly Label[], y: number): Label | undefined =>
  labels.find((l) => Math.abs(l.centre - y) <= SNAP);
