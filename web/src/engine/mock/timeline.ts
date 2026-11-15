// Mock counts use the same finished, ordered entries as mock windows; never just the current slice.
import type { Anchor, FromEngine, Query, Timeline } from '../protocol.ts';
import type { Entry } from './query.ts';

const dated = new Set(['home', 'global', 'hashtag', 'profile', 'channel', 'relay', 'search']);
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
  const positions: { key: string; month: number; offset: number }[] = [];
  let previous = Infinity;
  let newest = 0;
  let oldest = 0;
  let supported =
    dated.has(q.source) && !q.notifications && !['reposts', 'reactions'].includes(q.show ?? '');
  entries.forEach((e, i) => {
    const row = e.row();
    if (row.kind !== 'note' && row.kind !== 'notification') {
      if (row.kind !== 'profile' && row.kind !== 'channel') supported = false;
      return;
    }
    const time = row.kind === 'note' ? (row.repostedBy?.at ?? row.at) : row.at;
    const at = Math.min(time, now);
    if (previous === Infinity) newest = time;
    oldest = time;
    if (at > previous) supported = false;
    previous = at;
    const date = new Date(at);
    const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const offset = months.get(month) ?? 0;
    months.set(month, offset + 1);
    if ((i >= start && i < end) || e.key === returnKey)
      positions.push({ key: row.key, month, offset });
  });
  return {
    ...(anchor ? { anchor } : {}),
    supported,
    newest,
    oldest,
    months: [...months].map(([at, count]) => ({ at, count })),
    positions,
    older: false,
  };
}
export function timeKey(
  entries: readonly Entry[],
  anchor: Anchor,
  now: number,
): string | undefined {
  if (anchor === 'top') return;
  if ('key' in anchor) return anchor.key;
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
