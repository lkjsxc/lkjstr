// One map for marks, pointer seeks, the place line and return tick. Positions are note ordinals,
// never interpolated timestamps: even a one-note month owns a reachable interval.
import type { Timeline } from '../engine/protocol.ts';
export type TimePlace = { readonly month: number; readonly offset: number };
export type TimeBand = {
  readonly at: number;
  readonly count: number;
  readonly y: number;
  readonly h: number;
};
const FLOOR = 3; // px a month gets before its share of the notes
const FLOORS = 0.1; // the most of the rail all floors together take
const END_SHARE = 0.09;
const END_PIXELS = 72;
const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, n));
export const monthOf = (at: number, now = Date.now()): number => {
  const d = new Date(Math.min(at, now));
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const monthIndex = (at: number): number => {
  const date = new Date(at);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

/** An old suffix of at most three notes per month, across at least two empty months from a busy head. */
function isolatedTail(months: Timeline['months'], total: number) {
  let tail: { start: number; notes: number } | undefined;
  let notes = 0;
  for (let i = months.length - 1; i > 0; i--) {
    const month = months[i]!;
    notes += month.count;
    if (month.count > 3 || notes * 5 > total || total - notes < 60) break;
    if (monthIndex(months[i - 1]!.at) - monthIndex(month.at) >= 3) tail = { start: i, notes };
  }
  return tail;
}

/** Occupied months share the rail by rank with a small floor. An isolated sparse end gets one shared space
 * budget and keeps every ordinal. The recovered space goes back to the rest of the rail. */
export function timeScale(months: Timeline['months'], height: number): readonly TimeBand[] {
  const h = Math.max(0, height);
  const all = months.filter((m) => m.count > 0);
  if (!all.length) return [];
  const floor = Math.min(FLOOR, (h * FLOORS) / all.length);
  const notes = all.reduce((sum, m) => sum + m.count, 0);
  const unit = (h - floor * all.length) / notes;
  const tail = isolatedTail(all, notes);
  let headScale = 1;
  let tailScale = 1;
  if (tail) {
    const room = floor * (all.length - tail.start) + unit * tail.notes;
    const limit = Math.min(h * END_SHARE, END_PIXELS);
    if (room > limit) {
      tailScale = limit / room;
      headScale = (h - limit) / (h - room);
    }
  }
  let y = 0;
  return all.map((m, i) => {
    const size = (floor + unit * m.count) * (tail && i >= tail.start ? tailScale : headScale);
    const band = { ...m, y, h: size };
    y += size;
    return band;
  });
}
export function noteToPlace(bands: readonly TimeBand[], place: TimePlace): number {
  const band = bands.find((b) => b.at === place.month);
  return band ? band.y + (clamp(place.offset, band.count - 1) / band.count) * band.h : 0;
}
export function placeToNote(bands: readonly TimeBand[], y: number): TimePlace | undefined {
  const band = bands.find((b) => y < b.y + b.h) ?? bands.at(-1);
  if (!band) return;
  return {
    month: band.at,
    offset: clamp(Math.floor(((y - band.y) / band.h) * band.count + 1e-9), band.count - 1),
  };
}
