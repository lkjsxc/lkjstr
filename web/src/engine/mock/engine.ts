import {
  type EngineConfig,
  type FromEngine,
  PROTOCOL_VERSION,
  type ToEngine,
} from '../protocol.ts';
import { failedAccountInput } from './account-failure.ts';
import { createActions } from './actions.ts';
import { createCore } from './core.ts';
import { createPrivateMock } from './dm.ts';
import { addStress } from './fixtures-stress.ts';
import { addThreads } from './fixtures-thread.ts';
import { projectHidden, unshownOf } from './hidden.ts';
import { liveWindow } from './live-window.ts';
import { privateListState } from './private-lists.ts';
import { select } from './query.ts';
import { searchWindow } from './search-window.ts';
import { createSignerAuthMock } from './signer-auth.ts';
import { mockStats } from './stats.ts';
import { createStorageMock } from './storage.ts';
import type { MockEngineSub } from './subscription.ts';
import { seekTime } from './time-window.ts';
import { timeKey } from './timeline.ts';
import { createZapMock, MOCK_ZAP_EVIDENCE } from './zaps.ts';

export type MockEngine = {
  handle(msg: ToEngine): void;
  dispose(): void;
  readonly authorization: ReturnType<typeof createSignerAuthMock>;
};
export type Core = ReturnType<typeof createCore>;

export function createMockEngine(
  emit: (msg: FromEngine) => void,
  now = Date.now,
  boot: { accountError?: 'internal' } = {},
): MockEngine {
  let zapObserve: ((msg: FromEngine) => void) | undefined;
  let authObserve: ((msg: FromEngine) => void) | undefined;
  const post = (msg: FromEngine): void => {
    zapObserve?.(msg);
    authObserve?.(msg);
    emit(projectHidden(msg, 'sub' in msg ? core.subs.get(msg.sub)?.revealed : undefined));
  };
  const core: Core = createCore(post, now);
  const { world, subs, later } = core;
  let nextStatsView = 0;
  const stats = () => mockStats(core);
  const act = createActions(core);
  const authorization = createSignerAuthMock(post, now);
  authObserve = authorization.observe;
  const dm = createPrivateMock(core);
  const storage = createStorageMock(post);
  const zaps = createZapMock(core);
  zapObserve = zaps.observe;
  let config: EngineConfig = { language: 'en', heuristics: true, prefetch: true };
  let liveTimer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  let stopped = false;
  const live = (): void => {
    clearInterval(liveTimer);
    if (config.mock?.live === false) return;
    liveTimer = setInterval(() => act.tick(), 2600);
  };
  const start = (): void => {
    if (started) return;
    started = true;
    post({
      t: 'ready',
      version: PROTOCOL_VERSION,
      engine: 'mock',
      ...(boot.accountError ? { accountError: { code: boot.accountError } } : {}),
    });
    if (boot.accountError) return;
    core.accounts();
    core.status();
    live();
  };
  later(40, start);
  const dispose = (): void => {
    stopped = true;
    storage.dispose();
    authorization.dispose();
    act.dispose();
    dm.dispose();
    zaps.dispose();
    clearInterval(liveTimer);
    core.dispose();
  };
  return {
    authorization,
    handle(msg) {
      if (stopped || storage.handle(msg)) return;
      if (boot.accountError) {
        if (msg.t === 'detach') return dispose();
        start();
        if (msg.t === 'stats') post({ t: 'stats', req: msg.req, stats: stats() });
        else failedAccountInput(post, msg);
        return;
      }
      if (authorization.handle(msg)) return;
      if (zaps.handle(msg)) return;
      if (dm.handle(msg)) return;
      if (msg.t === 'upload.cancel') return act.cancelUpload(msg.req);
      if (msg.t === 'stats') post({ t: 'stats', req: msg.req, stats: stats() });
      else if (msg.t === 'cache.hold') {
        if (subs.has(msg.sub))
          post({
            t: 'cache.reconcile',
            sub: msg.sub,
            removedKeys: [],
            invalidProfileIds: [],
            removedQuoteIds: [],
          });
      } else if (msg.t === 'rowAtTime') {
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
        world.customEmoji = config.mock?.emoji !== 'none';
        core.clientTag = config.clientTag !== false;
        core.slow = config.mock?.slow;
        if (config.mock?.threads) addThreads(world);
        if (config.mock?.stress) addStress(world);
        if (!started && config.mock?.accounts === 'none') core.who.clear();
        if (started) live();
        else start();
      } else if (msg.t === 'hint') {
        const { visibleSubs, pageHidden } = msg.hint;
        const visible = new Set(pageHidden ? [] : visibleSubs);
        for (const sub of subs.values()) sub.visible = visible.has(sub.id);
      } else if (msg.t === 'open') {
        const s: MockEngineSub = {
          id: msg.sub,
          query: msg.query,
          statsId: subs.get(msg.sub)?.statsId ?? `view-${++nextStatsView}`,
          visible: msg.visible !== false,
          entries: select(world, msg.query, core.me(), core.profileWritable()),
          start: 0,
          end: 0,
          live: false,
          windowed: false,
          fresh: 0,
          ops: [],
        };
        subs.set(s.id, s);
        // Mock transport never passes through durable publicSnapshots; its fixtures may update UI names.
        post({ t: 'cache.policy', sub: s.id, allow: true });
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
            ...unshownOf(s.query),
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
                  ...unshownOf(s.query),
                },
              }),
          );
      } else if (msg.t === 'close') subs.delete(msg.sub);
      else if (msg.t === 'window') {
        const s = subs.get(msg.sub);
        if (!s) return;
        if (msg.anchor !== 'top' && 'at' in msg.anchor) {
          seekTime(s, msg.anchor.at, msg.before, msg.after, post);
          core.timelines();
          return;
        }
        s.timeRange = undefined;
        s.monthAnchor =
          msg.anchor !== 'top' && 'month' in msg.anchor ? msg.anchor.month : undefined;
        if (s.query.source === 'search') searchWindow(s, msg, core.now(), post);
        else {
          const key = timeKey(s.entries, msg.anchor, core.now());
          s.anchor = key;
          if (msg.anchor !== 'top' && 'month' in msg.anchor) s.returnKey = msg.anchor.returnKey;
          const found = msg.anchor === 'top' ? 0 : s.entries.findIndex((e) => e.key === key);
          const at = Math.max(0, found);
          s.live = msg.anchor === 'top' || found < 0;
          s.start = Math.max(0, at - (msg.retainAbove ? 6000 : msg.before));
          const tail =
            msg.anchor === 'top' && msg.headThrough
              ? s.entries.findIndex((entry) => entry.key === msg.headThrough) + 1
              : 0;
          s.end = Math.min(s.entries.length, Math.max(at + msg.after, tail));
        }
        s.windowed = true;
        s.ops = [];
        s.liveRange =
          msg.liveAbove && msg.anchor !== 'top' && s.query.source !== 'search'
            ? { before: msg.before, after: msg.after }
            : undefined;
        if (s.liveRange) return (liveWindow(s, post), core.timelines());
        if (s.live && s.fresh) (s.fresh = 0), post({ t: 'fresh', sub: s.id, count: 0 });
        const window = s.entries.slice(s.start, s.end);
        if (['profile', 'channel', 'relay'].includes(s.query.source) && s.start > 0 && s.entries[0])
          window.unshift(s.entries[0]);
        post({
          t: 'rows',
          sub: s.id,
          rows: window.map((e) => e.row()),
          atTop: s.start <= (['profile', 'channel', 'relay'].includes(s.query.source) ? 1 : 0),
          atBottom: s.end === s.entries.length,
        });
        core.timelines();
      } else if (msg.t === 'act') act.run(msg.req, msg.action);
    },
    dispose,
  };
}
