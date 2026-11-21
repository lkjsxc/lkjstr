import type { FromEngine, NoteRow } from '../protocol.ts';
import type { Sub } from './subscription.ts';

type Post = (message: FromEngine) => void;

export function seekTime(s: Sub, at: number, before: number, after: number, post: Post): void {
  if (
    s.query.notifications ||
    (s.query.source !== 'their-home' && !(s.query.source === 'home' && s.query.account))
  ) {
    post({ t: 'timeWindow', sub: s.id, at, newer: 'unsupported', older: 'unsupported' });
    return;
  }
  s.timeRange = { at, before: Math.min(800, before), after: Math.min(800, after) };
  s.windowed = true;
  s.live = false;
  s.liveRange = undefined;
  s.returnKey = undefined;
  timeWindow(s, post);
}

export function timeWindow(s: Sub, post: Post): void {
  const range = s.timeRange;
  if (!range) return;
  const { at, before, after } = range;
  const time = (row: NoteRow): number => row.repostedBy?.at ?? row.at;
  const notes = s.entries
    .map((entry) => entry.row())
    .filter((row): row is NoteRow => row.kind === 'note')
    .sort((a, b) => time(b) - time(a) || b.key.localeCompare(a.key));
  const split = notes.findIndex((row) => time(row) <= at);
  const middle = split < 0 ? notes.length : split;
  const start = Math.max(0, middle - before);
  const end = Math.min(notes.length, middle + after);
  const rows = notes.slice(start, end);
  const key = (end > middle ? notes[middle] : rows.at(-1))?.key;
  s.anchor = key;
  s.start = start;
  s.end = end;
  s.ops = [];
  s.fresh = 0;
  post({ t: 'rows', sub: s.id, rows, atTop: false, atBottom: false });
  post({ t: 'fresh', sub: s.id, count: 0 });
  post({
    t: 'timeWindow',
    sub: s.id,
    at,
    ...(key && { key }),
    ...(s.query.source === 'their-home' && { followList: { state: 'unknown' } as const }),
    newer: 'cache-only',
    older: 'cache-only',
  });
}
