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
const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, n));
export const monthOf = (at: number, now = Date.now()): number => {
  const d = new Date(Math.min(at, now));
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
export function timeScale(months: Timeline['months'], height: number): readonly TimeBand[] {
  const h = Math.max(0, height);
  const all = months.filter((m) => m.count > 0);
  const floor = Math.min(4, h / (2 * all.length));
  const weights = all.reduce((sum, m) => sum + Math.sqrt(m.count), 0);
  let y = 0;
  return all.map((m) => {
    const size = floor + ((h - floor * all.length) * Math.sqrt(m.count)) / weights;
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
