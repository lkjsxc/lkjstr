import {
  type EngineConfig,
  type FromEngine,
  PROTOCOL_VERSION,
  type ToEngine,
} from '../protocol.ts';
import { createActions } from './actions.ts';
import { createCore } from './core.ts';
import { createPrivateMock } from './dm.ts';
import { privateListState } from './private-lists.ts';
import { select } from './query.ts';
import { createSignerAuthMock } from './signer-auth.ts';
import { mockStats } from './stats.ts';
import type { Sub } from './subscription.ts';
import { timeKey } from './timeline.ts';
import { createZapMock, MOCK_ZAP_EVIDENCE } from './zaps.ts';

export type MockEngine = {
  handle(msg: ToEngine): void;
  dispose(): void;
  readonly authorization: ReturnType<typeof createSignerAuthMock>;
};
export type Core = ReturnType<typeof createCore>;

export function createMockEngine(post: (msg: FromEngine) => void, now = Date.now): MockEngine {
  let zapObserve: ((msg: FromEngine) => void) | undefined;
  let authObserve: ((msg: FromEngine) => void) | undefined;
  const core = createCore((msg) => {
    zapObserve?.(msg);
    authObserve?.(msg);
    post(msg);
  }, now);
  const { world, subs, later } = core;
  const act = createActions(core);
  const authorization = createSignerAuthMock(post, now);
  authObserve = authorization.observe;
  const dm = createPrivateMock(core);
  const zaps = createZapMock(core);
  zapObserve = zaps.observe;
  let config: EngineConfig = { language: 'en', heuristics: true, prefetch: true };
  let liveTimer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  const live = (): void => {
    clearInterval(liveTimer);
    if (config.mock?.live === false) return;
    liveTimer = setInterval(() => act.tick(), 2600);
  };
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
    authorization,
    handle(msg) {
      if (authorization.handle(msg)) return;
      if (zaps.handle(msg)) return;
      if (dm.handle(msg)) return;
      if (msg.t === 'upload.cancel') return act.cancelUpload(msg.req);
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
        authorization.dispose();
        act.dispose();
        clearInterval(liveTimer);
        core.dispose();
      } else if (msg.t === 'relays') {
        if (msg.relays.length > 8) return;
        world.state.relays = [...msg.relays];
        core.resync((q) => q.source === 'relays', true);
        core.status();
      } else if (msg.t === 'reading' || msg.t === 'preview')
        /* fixtures already contain the answer */ return;
      else if (msg.t === 'publicKey') act.publicKey(msg);
      else if (msg.t === 'configure') {
        config = msg.config;
        world.linkPreviews = config.linkPreviews !== false;
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
        core.timelines();
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
          state: {
            phase: done ? 'done' : 'cache',
            relaysAsked: done ? 0 : 6,
            relaysAnswered: 0,
            zapEvidence: MOCK_ZAP_EVIDENCE,
            ...privateListState(s.query),
          },
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
                  zapEvidence: MOCK_ZAP_EVIDENCE,
                  relaysAsked: 6,
                  relaysAnswered: 5,
                  lastArrival: world.notes[0]?.at,
                  ...privateListState(s.query),
                },
              }),
          );
      } else if (msg.t === 'close') subs.delete(msg.sub);
      else if (msg.t === 'window') {
        const s = subs.get(msg.sub);
        if (!s) return;
        const key = timeKey(s.entries, msg.anchor, core.now());
        s.anchor = key;
        if (msg.anchor !== 'top' && 'month' in msg.anchor) s.returnKey = msg.anchor.returnKey;
        const found = msg.anchor === 'top' ? 0 : s.entries.findIndex((e) => e.key === key);
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
        core.timelines();
      } else if (msg.t === 'act') act.run(msg.req, msg.action);
    },
    dispose() {
      authorization.dispose();
      act.dispose();
      dm.dispose();
      zaps.dispose();
      clearInterval(liveTimer);
      core.dispose();
    },
  };
}
