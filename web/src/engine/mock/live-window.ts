import type { FromEngine } from '../protocol.ts';
import type { Sub } from './subscription.ts';

export function liveWindow(s: Sub, post: (message: FromEngine) => void): void {
  if (!s.liveRange || !s.windowed) return;
  const at = Math.max(
    0,
    s.entries.findIndex((entry) => entry.key === s.anchor),
  );
  const header = (s.query.source === 'profile' || s.query.source === 'channel') && at > 0;
  s.start = Math.max(Number(header), at - s.liveRange.before);
  s.end = Math.min(s.entries.length, at + s.liveRange.after);
  s.ops = [];
  const window = s.entries.slice(s.start, s.end);
  if (header && s.entries[0]) window.unshift(s.entries[0]);
  const count = s.start - Number(header);
  post({
    t: 'rows',
    sub: s.id,
    rows: window.map((entry) => entry.row()),
    atTop: count === 0,
    atBottom: s.end === s.entries.length,
  });
  s.fresh = count;
  post({ t: 'fresh', sub: s.id, count });
}
