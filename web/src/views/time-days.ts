// Finding a note's local day on the rail, and the keyboard's day and month steps (docs/interface-time.md C3). Pure and
// tested. Places are the engine's note ordinals within UTC months; days only group them.
import type { Timeline } from '../engine/protocol.ts';
import { dayOf } from '../shared/format.ts';
import type { Day } from './time-marks.ts';
import type { TimeBand, TimePlace } from './time-scale.ts';

/** The engine's days when they are in the page's zone; otherwise none, and the rail falls back without them. */
export const railDays = (t: Pick<Timeline, 'days' | 'zone'> | undefined, zone: string) =>
  t?.days && t.zone === zone ? t.days : undefined;

/** The part holding `place`: the same month, and the place among its notes. */
export const partOf = (days: readonly Day[], place: TimePlace): number =>
  days.findIndex(
    (d) => d.month === place.month && d.offset <= place.offset && place.offset < d.offset + d.count,
  );

/** `yyyy/mm/dd` of the day holding `place`, or '' when no day is known. */
export function dayText(days: readonly Day[] | undefined, place: TimePlace): string {
  const part = days?.[partOf(days, place)];
  return part ? dayOf(part.at) : '';
}

/** The newest note of the next occupied day, newer (-1) or older (1); undefined at the ends. */
export function stepDay(
  days: readonly Day[],
  place: TimePlace,
  dir: -1 | 1,
): TimePlace | undefined {
  const at = days[partOf(days, place)]?.at;
  if (at === undefined) return;
  // Parts run newest first; a day's newest part is the first of its parts.
  const next =
    dir > 0
      ? days.find((d) => d.at < at)
      : days.findLast((d, i) => d.at > at && days[i - 1]?.at !== d.at);
  return next && { month: next.month, offset: next.offset };
}

/** The newest note of the next occupied month, newer (-1) or older (1); undefined at the ends. */
export function stepMonth(
  bands: readonly TimeBand[],
  place: TimePlace,
  dir: -1 | 1,
): TimePlace | undefined {
  const i = bands.findIndex((b) => b.at === place.month);
  const next = i < 0 ? undefined : bands[i + dir];
  return next && { month: next.at, offset: 0 };
}
