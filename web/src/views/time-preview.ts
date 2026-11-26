import { type RailRow, rowTime } from './feed-scrub.ts';
import { createTimeParts } from './time-parts.ts';
import { monthOf } from './time-scale.ts';

export const dated = (r: RailRow): boolean =>
  r.kind === 'note' || r.kind === 'notification' || r.kind === 'dm';

/** Provisional marks from the rows already delivered, in their reading order. */
export function timePreview(rows: readonly RailRow[], now = Date.now()) {
  const months = new Map<number, number>();
  const parts = createTimeParts();
  let previous = now;
  for (const row of rows) {
    if (!dated(row)) continue;
    const at = Math.min(rowTime(row), previous);
    previous = at;
    const month = monthOf(at, now);
    const offset = months.get(month) ?? 0;
    months.set(month, offset + 1);
    parts.count(at, month, offset);
  }
  return { months: [...months].map(([at, count]) => ({ at, count })), ...parts.fields() };
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
