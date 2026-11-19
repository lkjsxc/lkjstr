// Shared mock policy and bounded fixture subscriptions.
import type { FromEngine, PatchOp, Query } from '../protocol.ts';
import { createAccounts } from './accounts.ts';
import { liveWindow } from './live-window.ts';
import { privateListAccountSnapshot, privateListState } from './private-lists.ts';
import { entry, matches, select } from './query.ts';
import { relays } from './relays.ts';
import { searchPrefix } from './search.ts';
import { refreshSearch, resyncSearch } from './search-window.ts';
import type { Sub } from './subscription.ts';
import { sendTimelines } from './timeline.ts';
import { createWorld, type MNote } from './world.ts';
import { MOCK_ZAP_EVIDENCE } from './zaps.ts';

const PATCH_MS = 80;
export function createCore(post: (msg: FromEngine) => void, now: () => number) {
  const world = createWorld(now());
  const subs = new Map<string, Sub>(); // bound: the interface's open subscriptions
  const timers = new Set<ReturnType<typeof setTimeout>>(); // bound: pending mock delays
  const who = createAccounts();
  let unread = 3;
  let flushing = false;
  const timelines = (): void => sendTimelines(subs.values(), post, now());
  let timelineQueued = false;
  const queueTimeline = (): void => {
    if (timelineQueued) return;
    timelineQueued = true;
    later(PATCH_MS, () => ((timelineQueued = false), timelines()));
  };
  const me = (): string => who.active() ?? '';
  const later = (ms: number, fn: () => void): void => {
    const t = setTimeout(() => (timers.delete(t), fn()), ms);
    timers.add(t);
  };
  const flush = (): void => {
    flushing = false;
    timelines();
    for (const s of subs.values()) {
      if (!s.ops.length) continue;
      post({ t: 'patch', sub: s.id, ops: s.ops });
      s.ops = [];
    }
  };
  const push = (s: Sub, op: PatchOp): void => {
    s.ops.push(op);
    if (!flushing) (flushing = true), later(PATCH_MS, flush);
  };
  const inWindow = (s: Sub, i: number): boolean =>
    s.windowed &&
    ((i >= s.start && i < s.end) ||
      (i === 0 && (s.query.source === 'profile' || s.query.source === 'channel')));
  const accounts = (): void => post(privateListAccountSnapshot(who, unread));
  return {
    world,
    timelines,
    clientTag: true,
    subs,
    post,
    now,
    later,
    me,
    accounts,
    who,
    setUnread: (n: number) => void (unread = n),
    status(): void {
      const used = relays(world).filter((r) => r.inUse || r.read || r.write);
      const connected = used.filter((r) => r.state === 'connected').length;
      post({ t: 'status', connected, wanted: used.length, offline: false });
    },
    changed(id: string): void {
      for (const s of subs.values())
        s.entries.forEach((e, i) => {
          if (e.key === id && inWindow(s, i)) push(s, { op: 'update', row: e.row() });
        });
    },
    arrived(n: MNote): void {
      for (const s of subs.values()) {
        const note = s.query.source !== 'thread' && matches(world, s.query, n, me());
        const reply = s.query.source === 'thread' && s.entries.some((e) => e.key === n.re);
        if (!note && !reply) continue;
        if (reply) {
          const e = entry(world, n, { me: me(), thread: { role: 'reply', depth: 1 } });
          s.entries.push(e);
          if (s.windowed && s.end === s.entries.length - 1)
            s.end++, push(s, { op: 'insert', before: null, rows: [e.row()] });
          continue;
        }
        const search = s.query.source === 'search';
        const at = search
          ? searchPrefix(s.entries)
          : s.query.source === 'profile' || s.query.source === 'channel'
            ? 1
            : 0;
        const e = entry(world, n, { me: me(), reposts: s.query.reposts });
        const first = s.entries[at]?.key ?? null;
        s.entries.splice(at, 0, e);
        queueTimeline();
        if (!s.windowed) continue;
        if (search) refreshSearch(s, post);
        else if (s.liveRange) liveWindow(s, post);
        else if (s.live) s.end++, push(s, { op: 'insert', before: first, rows: [e.row()] });
        else s.start++, s.end++, post({ t: 'fresh', sub: s.id, count: ++s.fresh });
        post({
          t: 'state',
          sub: s.id,
          state: {
            phase: 'live',
            relaysAsked: 6,
            relaysAnswered: 5,
            lastArrival: n.at,
            zapEvidence: MOCK_ZAP_EVIDENCE,
            ...privateListState(s.query),
          },
        });
      }
    },
    resync(only?: (q: Query) => boolean, refresh = false): void {
      for (const s of subs.values()) {
        if (only && !only(s.query)) continue;
        const next = select(world, s.query, me());
        if (s.query.source === 'search') {
          resyncSearch(s, next, post);
          queueTimeline();
          continue;
        }
        const shown = s.entries.slice(s.start, s.end);
        const had = new Set(s.entries.map((e) => e.key));
        const wasBottom = s.end === s.entries.length;
        s.entries = next;
        queueTimeline();
        if (!s.windowed) continue;
        if (s.liveRange) {
          liveWindow(s, post);
          continue;
        }
        const index = new Map(next.map((e, i) => [e.key, i]));
        for (const e of shown) if (!index.has(e.key)) push(s, { op: 'remove', key: e.key });
        const kept = shown.filter((e) => index.has(e.key));
        const last = kept[kept.length - 1];
        if (!s.live) s.start = kept[0] ? (index.get(kept[0].key) ?? 0) : 0;
        s.end =
          wasBottom || !last
            ? Math.min(next.length, s.start + 200)
            : (index.get(last.key) ?? 0) + 1;
        for (let i = s.end - 1; i >= s.start; i--) {
          const e = next[i];
          if (!e || had.has(e.key)) continue;
          const after = i + 1 < s.end ? next[i + 1] : undefined;
          push(s, { op: 'insert', before: after?.key ?? null, rows: [e.row()] });
        }
        s.fresh = s.live ? 0 : s.start;
        post({ t: 'fresh', sub: s.id, count: s.fresh });
        if (!refresh) continue;
        if (
          (s.query.source === 'profile' || s.query.source === 'channel') &&
          s.start > 0 &&
          next[0]
        )
          push(s, { op: 'update', row: next[0].row() });
        for (const old of kept) {
          const e = next[index.get(old.key) ?? -1]; // the new entry: a finite list's rows are made afresh
          if (e) push(s, { op: 'update', row: e.row() });
        }
      }
    },
    dispose(): void {
      for (const t of timers) clearTimeout(t);
      timers.clear(), subs.clear();
    },
  };
}
