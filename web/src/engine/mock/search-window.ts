import type { FromEngine, ToEngine } from '../protocol.ts';
import type { Entry } from './query.ts';
import { searchPrefix } from './search.ts';
import type { Sub } from './subscription.ts';
import { timeKey } from './timeline.ts';

type Window = Extract<ToEngine, { t: 'window' }>;
type Post = (msg: FromEngine) => void;
function range(s: Sub, post: Post): void {
  const intent = s.searchRange;
  if (!intent) return;
  const prefix = searchPrefix(s.entries);
  const found = s.live ? -1 : s.entries.findIndex((e, i) => i >= prefix && e.key === s.anchor);
  const at = Math.max(0, found - prefix);
  const start = Math.max(0, at - (intent.retainAbove ? 6000 : intent.before));
  s.start = start === 0 ? 0 : prefix + start;
  s.end = Math.min(s.entries.length, prefix + at + Math.max(intent.after, 1));
  const count = s.live ? 0 : start;
  if (s.fresh === count) return;
  s.fresh = count;
  post({ t: 'fresh', sub: s.id, count });
}

/** Internal indexes include the prefix; incoming budgets and Fresh counts are note-only. */
export function searchWindow(s: Sub, msg: Window, now: number, post: Post): void {
  const prefix = searchPrefix(s.entries);
  const normalize = (key: string | undefined): string | undefined =>
    s.windowed &&
    s.start === 0 &&
    s.entries.slice(0, Math.min(prefix, s.end)).some((e) => e.key === key)
      ? s.entries[prefix]?.key
      : key;
  const key = normalize(timeKey(s.entries, msg.anchor, now));
  s.anchor = key;
  if (msg.anchor !== 'top' && 'month' in msg.anchor) s.returnKey = normalize(msg.anchor.returnKey);
  s.live = msg.anchor === 'top' || !s.entries.some((e, i) => i >= prefix && e.key === key);
  s.searchRange = {
    before: msg.before,
    after: msg.after,
    retainAbove: msg.retainAbove ?? false,
  };
  range(s, post);
}

/** Re-evaluate the held note and its requested before budget after an arrival or policy change. */
export function refreshSearch(s: Sub, post: Post): void {
  if (!s.windowed) return;
  range(s, post);
  s.ops = [];
  post({
    t: 'rows',
    sub: s.id,
    rows: s.entries.slice(s.start, s.end).map((e) => e.row()),
    atTop: s.start === 0,
    atBottom: s.end === s.entries.length,
  });
}
export function resyncSearch(s: Sub, next: Entry[], post: Post): void {
  s.entries = next;
  refreshSearch(s, post);
}
