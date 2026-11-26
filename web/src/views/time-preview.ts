import { localDay } from '../shared/format.ts';
import { type RailRow, rowTime } from './feed-scrub.ts';
import type { Day } from './time-marks.ts';
import { monthOf } from './time-scale.ts';

export const dated = (r: RailRow): boolean =>
  r.kind === 'note' || r.kind === 'notification' || r.kind === 'dm';

/** Provisional marks from the rows already delivered, in their reading order. */
export function timePreview(rows: readonly RailRow[], now = Date.now()) {
  const months = new Map<number, number>();
  const days: Day[] = [];
  const hours: Day[] = [];
  let previous = now;
  for (const row of rows) {
    if (!dated(row)) continue;
    const at = Math.min(rowTime(row), previous);
    previous = at;
    const month = monthOf(at, now);
    const offset = months.get(month) ?? 0;
    months.set(month, offset + 1);
    const d = new Date(at);
    for (const [parts, start] of [
      [days, localDay(at)],
      [hours, at - ((d.getMinutes() * 60 + d.getSeconds()) * 1000 + d.getMilliseconds())],
    ] as const) {
      const last = parts.at(-1);
      if (last?.at === start && last.month === month)
        parts[parts.length - 1] = { ...last, count: last.count + 1 };
      else parts.push({ at: start, month, count: 1, offset });
    }
  }
  return { months: [...months].map(([at, count]) => ({ at, count })), days, hours };
}

export function createTimePreview() {
  let snapshot: ReturnType<typeof timePreview> | undefined;
  let source: readonly RailRow[] | undefined;
  let localZone = '';
  return {
    read(rows: readonly RailRow[], zone: string, held: boolean) {
      if (!snapshot || (!held && (source !== rows || localZone !== zone))) {
        snapshot = timePreview(rows);
        source = rows;
        localZone = zone;
      }
      return snapshot;
    },
    clear: () => void (snapshot = source = undefined),
  };
}
