// Mock counts use the same finished, ordered entries as mock windows; never just the current slice.
import { localDay, localZone } from '../../shared/format.ts';
import type { Anchor, FromEngine, Query, Timeline } from '../protocol.ts';
import type { Entry } from './query.ts';

// As crates/lkjstr-core/src/engine/wire/timeline.rs: grouped and activity lists index their drawn rows.
const dated = new Set([
  'home',
  'their-home',
  'notifications',
  'global',
  'hashtag',
  'profile',
  'channel',
  'relay',
  'search',
]);
export function timeline(
  q: Query,
  entries: readonly Entry[],
  start: number,
  end: number,
  now: number,
  anchor?: string,
  returnKey?: string,
): Timeline {
  const months = new Map<number, number>();
  const positions: { key: string; month: number; offset: number; at: number }[] = [];
  // Local days as the real engine counts them (crates/lkjstr-core/src/engine/wire/timeline_days.rs).
  const days: { at: number; month: number; offset: number; count: number }[] = [];
  let occupied = 0;
  let previous = Infinity;
  let newest = 0;
  let oldest = 0;
  // Signed-out Global holds rows by their window's context: no cache-wide ordinal exists.
  let supported = dated.has(q.source) && !(q.source === 'global' && !q.account);
  entries.forEach((e, i) => {
    const row = e.row();
    if (row.kind !== 'note' && row.kind !== 'notification') {
      if (
        row.kind !== 'profile' &&
        row.kind !== 'channel' &&
        !(q.source === 'search' && row.kind === 'person')
      )
        supported = false;
      return;
    }
    const time = row.kind === 'note' ? (row.repostedBy?.at ?? row.at) : row.at;
    // Months stay monotonic in list order; the position keeps the row's own time.
    const at = Math.min(time, now, previous);
    if (previous === Infinity) newest = time;
    oldest = time;
    previous = at;
    const date = new Date(at);
    const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const offset = months.get(month) ?? 0;
    months.set(month, offset + 1);
    const day = localDay(at);
    const part = days.at(-1);
    if (part?.at === day && part.month === month) part.count++;
    else (occupied += part?.at === day ? 0 : 1), days.push({ at: day, month, offset, count: 1 });
    if ((i >= start && i < end) || e.key === returnKey)
      positions.push({ key: row.key, month, offset, at: time });
  });
  return {
    ...(anchor ? { anchor } : {}),
    supported,
    newest,
    oldest,
    months: [...months].map(([at, count]) => ({ at, count })),
    positions,
    older: false,
    zone: localZone(),
    ...(occupied <= 400 ? { days } : {}),
  };
}
export function timeKey(
  entries: readonly Entry[],
  anchor: Anchor,
  now: number,
): string | undefined {
  if (anchor === 'top') return;
  if ('key' in anchor) return anchor.key;
  if ('at' in anchor) return;
  const data = timeline({ source: 'global' }, entries, 0, entries.length, now);
  return data.positions.find((p) => p.month === anchor.month && p.offset === anchor.offset)?.key;
}

/** Bound: mounted subscriptions. Called immediately for windows, debounced for membership changes. */
export function sendTimelines(
  subs: Iterable<{
    id: string;
    query: Query;
    entries: Entry[];
    start: number;
    end: number;
    anchor?: string;
    returnKey?: string;
    timeline?: string;
  }>,
  post: (msg: FromEngine) => void,
  now: number,
): void {
  for (const s of subs) {
    const value = timeline(s.query, s.entries, s.start, s.end, now, s.anchor, s.returnKey);
    const encoded = JSON.stringify(value);
    if (s.timeline === encoded) continue;
    s.timeline = encoded;
    post({ t: 'timeline', sub: s.id, timeline: value });
  }
}
