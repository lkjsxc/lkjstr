// The mock engine: answers the protocol from an in-memory world, with the behaviours the interface must cope
// with (arrivals, batched patches, slow and failing relays, partial counts). It is also the test double: `handle`
// takes a message and `post` receives the answers, with no Worker in between.
import {
  type Account,
  type EngineConfig,
  type FromEngine,
  type PatchOp,
  PROTOCOL_VERSION,
  type Query,
  type ToEngine,
} from '../protocol.ts';
import { createAccounts } from './accounts.ts';
import { createActions } from './actions.ts';
import { type Entry, entry, matches, select } from './query.ts';
import { relays } from './relays.ts';
import { mockStats } from './stats.ts';
import { createWorld, type MNote } from './world.ts';

const PATCH_MS = 80;
type Sub = {
  readonly id: string;
  readonly query: Query;
  entries: Entry[];
  start: number;
  end: number;
  live: boolean;
  windowed: boolean;
  fresh: number;
  ops: PatchOp[];
};
export type MockEngine = { handle(msg: ToEngine): void; dispose(): void };
export type Core = ReturnType<typeof createCore>;

function createCore(post: (msg: FromEngine) => void, now: () => number) {
  const world = createWorld(now());
  const subs = new Map<string, Sub>(); // bound: the interface's open subscriptions
  const timers = new Set<ReturnType<typeof setTimeout>>(); // bound: pending mock delays
  const who = createAccounts();
  let unread = 3;
  let flushing = false;
  const me = (): string => who.active() ?? '';
  const later = (ms: number, fn: () => void): void => {
    const t = setTimeout(() => (timers.delete(t), fn()), ms);
    timers.add(t);
  };
  const flush = (): void => {
    flushing = false;
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
  const inWindow = (s: Sub, i: number): boolean => s.windowed && i >= s.start && i < s.end;
  const accounts = (): void => {
    const list: Account[] = who.list().map((a, i) => ({ ...a, unread: i === 0 ? unread : 0 }));
    post({ t: 'accounts', accounts: list, active: who.active() });
  };

  return {
    world,
    clientTag: true,
    subs,
    post,
    now,
    later,
    me,
    accounts,
    who,
    setUnread: (n: number) => void (unread = n),
    /** The connection summary, from the relay rows as they are now. */
    status(): void {
      const used = relays(world).filter((r) => r.inUse || r.read || r.write);
      const connected = used.filter((r) => r.state === 'connected').length;
      post({ t: 'status', connected, wanted: used.length, offline: false });
    },
    /** A note changed: every window that shows it gets the row again. */
    changed(id: string): void {
      for (const s of subs.values())
        s.entries.forEach((e, i) => {
          if (e.key === id && inWindow(s, i)) push(s, { op: 'update', row: e.row() });
        });
    },
    /** A new note: inserted where a window follows the head, counted where it does not. */
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
        const at = s.query.source === 'profile' || s.query.source === 'channel' ? 1 : 0;
        const e = entry(world, n, { me: me(), reposts: s.query.reposts });
        const first = s.entries[at]?.key ?? null;
        s.entries.splice(at, 0, e);
        if (!s.windowed) continue;
        if (s.live) s.end++, push(s, { op: 'insert', before: first, rows: [e.row()] });
        else s.start++, s.end++, post({ t: 'fresh', sub: s.id, count: ++s.fresh });
        post({
          t: 'state',
          sub: s.id,
          state: { phase: 'live', relaysAsked: 6, relaysAnswered: 5, lastArrival: n.at },
        });
      }
    },
    /** Lists whose membership changed (a mute, a bookmark, a deletion): the difference goes out as ops.
     * `refresh` also sends every row that stayed (a follow changes what person rows say). */
    resync(only?: (q: Query) => boolean, refresh = false): void {
      for (const s of subs.values()) {
        if (only && !only(s.query)) continue;
        const next = select(world, s.query, me());
        const shown = s.entries.slice(s.start, s.end);
        const had = new Set(s.entries.map((e) => e.key));
        const wasBottom = s.end === s.entries.length;
        s.entries = next;
        if (!s.windowed) continue;
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
        for (const old of kept) {
          const e = next[index.get(old.key) ?? -1]; // the new entry: a finite list's rows are made afresh
          if (e) push(s, { op: 'update', row: e.row() });
        }
      }
    },
    dispose(): void {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      subs.clear();
    },
  };
}

export function createMockEngine(post: (msg: FromEngine) => void, now = Date.now): MockEngine {
  const core = createCore(post, now);
  const { world, subs, later } = core;
  const act = createActions(core);
  let config: EngineConfig = { language: 'en', heuristics: true, prefetch: true };
  let liveTimer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  const live = (): void => {
    clearInterval(liveTimer);
    if (config.mock?.live === false) return;
    liveTimer = setInterval(() => act.tick(), 2600);
  };
  /** Says ready and who is signed in: at the first `configure` (which may ask for a first visit with nobody
   * signed in), or by itself a moment later for an interface that never configures. */
  const start = (): void => {
    if (started) return;
    started = true;
    post({ t: 'ready', version: PROTOCOL_VERSION, engine: 'mock' });
    core.accounts();
    core.status();
    live();
  };
  later(40, start);

  return {
    handle(msg) {
      if (msg.t === 'stats') post({ t: 'stats', req: msg.req, stats: mockStats(core) });
      else if (msg.t === 'rowAtTime') {
        const row = subs
          .get(msg.sub)
          ?.entries.map((e) => e.row())
          .find((r) => 'at' in r && r.at <= msg.at);
        post({
          t: 'rowAtTime',
          req: msg.req,
          sub: msg.sub,
          key: row?.key,
          at: row && 'at' in row ? row.at : undefined,
          cached: true,
        });
      } else if (msg.t === 'heartbeat') post({ t: 'heartbeat' });
      else if (msg.t === 'detach') {
        clearInterval(liveTimer);
        core.dispose();
      } else if (msg.t === 'relays') {
        if (msg.relays.length > 8) return;
        world.state.relays = [...msg.relays];
        core.resync((q) => q.source === 'relays', true);
        core.status();
      } else if (msg.t === 'publicKey') act.publicKey(msg);
      else if (msg.t === 'configure') {
        config = msg.config;
        core.clientTag = config.clientTag !== false;
        if (!started && config.mock?.accounts === 'none') core.who.clear();
        if (started) live();
        else start();
      } else if (msg.t === 'open') {
        const s: Sub = {
          id: msg.sub,
          query: msg.query,
          entries: select(world, msg.query, core.me()),
          start: 0,
          end: 0,
          live: false,
          windowed: false,
          fresh: 0,
          ops: [],
        };
        subs.set(s.id, s);
        const nobody =
          !core.me() && ['home', 'notifications', 'bookmarks'].includes(msg.query.source);
        const done =
          nobody ||
          ![
            'home',
            'global',
            'hashtag',
            'search',
            'profile',
            'thread',
            'list',
            'relay',
            'notifications',
            'channel',
          ].includes(msg.query.source);
        post({
          t: 'state',
          sub: s.id,
          state: { phase: done ? 'done' : 'cache', relaysAsked: done ? 0 : 6, relaysAnswered: 0 },
        });
        if (!done)
          later(
            600,
            () =>
              subs.has(s.id) &&
              post({
                t: 'state',
                sub: s.id,
                state: {
                  phase: 'live',
                  relaysAsked: 6,
                  relaysAnswered: 5,
                  lastArrival: world.notes[0]?.at,
                },
              }),
          );
      } else if (msg.t === 'close') subs.delete(msg.sub);
      else if (msg.t === 'window') {
        const s = subs.get(msg.sub);
        if (!s) return;
        const found =
          msg.anchor === 'top'
            ? 0
            : s.entries.findIndex((e) => e.key === (msg.anchor as { key: string }).key);
        const at = Math.max(0, found);
        s.live = msg.anchor === 'top' || found < 0;
        s.start = Math.max(0, at - (msg.retainAbove ? 6000 : msg.before));
        s.end = Math.min(s.entries.length, at + msg.after);
        s.windowed = true;
        s.ops = [];
        if (s.live && s.fresh) (s.fresh = 0), post({ t: 'fresh', sub: s.id, count: 0 });
        post({
          t: 'rows',
          sub: s.id,
          rows: s.entries.slice(s.start, s.end).map((e) => e.row()),
          atTop: s.start === 0,
          atBottom: s.end === s.entries.length,
        });
      } else if (msg.t === 'act') act.run(msg.req, msg.action);
    },
    dispose() {
      clearInterval(liveTimer);
      core.dispose();
    },
  };
}
