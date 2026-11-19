// One page's subscriptions, actions and private writer leases behind the real or mock Worker.
import { learnPerson, learnRows, onPerson } from '../shared/people.ts';
import { createSignal } from '../shared/signal.ts';
import { createActionRequests } from './client-actions.ts';
import type { AccountState, Accounts, Engine, SubHandlers } from './client-api.ts';
import { answerPublicKey, answerSign } from './client-crypto.ts';
import { createDeliveryWatches } from './client-delivery.ts';
import { createDmClient } from './client-dm.ts';
import { createPrivateListClient } from './client-private-lists.ts';
import { createSignerAuthClient } from './client-signer-auth.ts';
import { createStorageClient } from './client-storage.ts';
import type { Transport } from './client-transport.ts';
import { createZapClient } from './client-zaps.ts';
import { writingHasPriority } from './dm-watch.ts';
import type { EngineStats, Hint } from './protocol.ts';

export type {
  AccountState,
  Accounts,
  ActResult,
  ActWatch,
  Engine,
  SubHandlers,
  Subscription,
} from './client-api.ts';
export { type Transport, workerTransport } from './client-transport.ts';

const IDLE_MS = 180_000;
const STATS_MS = 4000;

export function createEngine(transport: Transport): Engine {
  const dm = createDmClient(transport);
  const signerAuth = createSignerAuthClient(transport);
  const zaps = createZapClient(transport);
  const storage = createStorageClient(transport);
  storage.visible(document.visibilityState !== 'hidden');
  const lists = createPrivateListClient(dm.access, (message) => transport.post(message));
  const subs = new Map<string, SubHandlers>(); // bound: open subscriptions (one per mounted list)
  const privateRows = new Set<string>(); // Bound by owned subscriptions; excludes private-derived author hints.
  const owners = new Map<string, HTMLElement>(); // bound: open subscriptions
  const visible = new Set<string>(); // bound: as `subs`
  const asked = new Map<string, (s: EngineStats | undefined) => void>(); // bound: `stats` requests in flight
  const accounts = createSignal<Accounts>({ accounts: [] });
  const accountState = createSignal<AccountState>({ phase: 'loading' });
  const status = createSignal({ connected: 0, wanted: 0, offline: false });
  const info = createSignal<{ engine: string; version: number } | null>(null);
  let serial = 0;
  let idle = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let hintQueued = false;

  const hint = (): void => {
    if (hintQueued) return;
    hintQueued = true;
    queueMicrotask(() => {
      hintQueued = false;
      const net = (
        navigator as { connection?: { saveData?: boolean; effectiveType?: Hint['effectiveType'] } }
      ).connection;
      transport.post({
        t: 'hint',
        hint: {
          visibleSubs: [...visible],
          deliveryWatches: deliveries.ids(),
          focusedSub: [...visible].find((id) => owners.get(id)?.closest('.pane.cur')),
          pageHidden: document.visibilityState === 'hidden',
          idle,
          saveData: net?.saveData === true,
          effectiveType: net?.effectiveType,
          deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
        },
      });
    });
  };
  const deliveries = createDeliveryWatches(hint);
  const actions = createActionRequests(
    transport,
    () => `r${++serial}`,
    (req, watch) => deliveries.add(req, watch),
  );
  const active = (): void => {
    idle = false;
    hint();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ((idle = true), hint()), IDLE_MS);
  };
  const resumed = (): void => {
    storage.visible(document.visibilityState !== 'hidden');
    if (document.visibilityState !== 'hidden') dm.flushers.resume(info.get()?.version ?? 0);
    else lists.hidden();
    hint();
  };
  document.addEventListener('visibilitychange', resumed);
  window.addEventListener('pageshow', resumed);
  document.addEventListener('focusin', hint);
  window.addEventListener('pointerdown', active, { passive: true, capture: true });
  window.addEventListener('keydown', active, { passive: true, capture: true });
  active();

  const offPeople = onPerson((author) => {
    const value = accounts.get();
    if (
      !value.accounts.some(
        (a) =>
          a.author.pubkey === author.pubkey && JSON.stringify(a.author) !== JSON.stringify(author),
      )
    )
      return;
    accounts.set({
      ...value,
      accounts: value.accounts.map((a) =>
        a.author.pubkey === author.pubkey ? { ...a, author } : a,
      ),
    });
  });
  transport.listen((msg) => {
    if (storage.receive(msg) || signerAuth.receive(msg)) return;
    if (msg.t === 'cache.policy') {
      if (subs.has(msg.sub)) {
        if (msg.allow) privateRows.delete(msg.sub);
        else privateRows.add(msg.sub);
      }
    } else if (msg.t === 'rows') {
      if (!privateRows.has(msg.sub)) learnRows(msg.rows);
      subs.get(msg.sub)?.rows(msg.rows, msg.atTop, msg.atBottom);
    } else if (msg.t === 'timeline') subs.get(msg.sub)?.timeline?.(msg.timeline);
    else if (msg.t === 'patch') {
      for (const op of privateRows.has(msg.sub) ? [] : msg.ops) {
        if (op.op === 'update') learnRows([op.row]);
        else if (op.op === 'insert') learnRows(op.rows);
      }
      subs.get(msg.sub)?.patch(msg.ops);
    } else if (msg.t === 'fresh') subs.get(msg.sub)?.fresh?.(msg.count);
    else if (msg.t === 'state') subs.get(msg.sub)?.state?.(msg.state);
    else if (msg.t === 'progress') actions.progress(msg);
    else if (msg.t === 'publish.signed') actions.signed(msg);
    else if (msg.t === 'delivery') deliveries.receive(msg);
    else if (msg.t === 'result') {
      actions.result(msg);
      deliveries.result(msg);
    } else if (msg.t === 'accounts') {
      dm.access.accounts(msg.accounts);
      accounts.set({
        accounts: msg.accounts.map((a) => ({ ...a, author: learnPerson(a.author) })),
        active: msg.active,
      });
      accountState.set({ phase: 'ready' });
    } else if (msg.t === 'status')
      status.set({ connected: msg.connected, wanted: msg.wanted, offline: msg.offline });
    else if (msg.t === 'reconnect') {
      accountState.set({ phase: 'loading' });
      dm.flushers.suspend();
      lists.hidden();
    } else if (msg.t === 'ready') {
      if (msg.accountError) accountState.set({ phase: 'failed', error: { code: 'internal' } });
      dm.flushers.ready(msg.version);
      info.set({ engine: msg.engine, version: msg.version });
    } else if (msg.t === 'stats') asked.get(msg.req)?.(msg.stats);
    else if (msg.t === 'dm') dm.receive(msg);
    else if (msg.t === 'zap.quote' || msg.t === 'zap.receipts') zaps.receive(msg);
    else if (msg.t === 'dm.flush') dm.flushers.receive(msg);
    else if (msg.t === 'crypt.cancel') lists.cancel(msg.req);
    else if (msg.t === 'crypt') {
      if (msg.context) void lists.crypt(msg);
      else void dm.access.crypt(msg, () => writingHasPriority(actions.posting));
    } else if (msg.t === 'sign') void answerSign(msg, (m) => transport.post(m), actions.wantsSign);
    else if (msg.t === 'getPublicKey') void answerPublicKey(msg.req, (m) => transport.post(m));
  });
  return {
    posting: actions.posting,
    dm,
    signerAuth,
    storage,
    zaps,
    accounts,
    accountState,
    status,
    info,
    me: () => accounts.get().active ?? '',
    open(query, handlers, owner) {
      const id = `s${++serial}`;
      let reading: string | null | undefined;
      subs.set(id, handlers);
      if (owner) owners.set(id, owner);
      lists.open(id, query);
      transport.post({
        t: 'open',
        sub: id,
        query,
        ...(query.privateLists ? { visible: false } : {}),
      });
      return {
        id,
        near: (ids) => {
          if ((info.get()?.version ?? 0) >= 5) transport.post({ t: 'preview', sub: id, ids });
        },
        reading: (key) => {
          if (!subs.has(id) || (info.get()?.version ?? 0) < 9 || key === reading) return;
          transport.post({ t: 'reading', sub: id, key: (reading = key) });
        },
        window: (anchor, before, after, liveAbove) =>
          transport.post({
            t: 'window',
            sub: id,
            anchor,
            before,
            after,
            ...(liveAbove ? { liveAbove: true } : {}),
            // Protocol 3 retains up to 6000 cached rows already read. An 800-row moving window otherwise
            // discards the beginning while paging down, making a return to the top fetch and jump.
            ...(anchor !== 'top' && before > 0 && !liveAbove && (info.get()?.version ?? 0) >= 3
              ? { retainAbove: true }
              : {}),
          }),
        visible(on) {
          lists.visible(id, on);
          if (on === visible.has(id)) return;
          if (on) visible.add(id);
          else visible.delete(id);
          hint();
        },
        close() {
          if (!subs.delete(id)) return;
          privateRows.delete(id);
          lists.close(id);
          visible.delete(id);
          owners.delete(id);
          hint();
          transport.post({ t: 'close', sub: id });
        },
      };
    },
    act: (action, watch) => {
      if (
        action.a !== 'account.lock' ||
        (info.get()?.version ?? 0) >= 8 ||
        !dm.flushers.has(action.pubkey)
      )
        return actions.act(action, watch);
      return dm.flushers
        .run(action.pubkey)
        .then((ok) =>
          ok
            ? actions.act(action, watch)
            : { t: 'result', req: 'private-lock', ok: false, error: { code: 'internal' } },
        );
    },
    stats() {
      const req = `q${++serial}`;
      return new Promise((done) => {
        const end = (s: EngineStats | undefined): void => {
          clearTimeout(timer);
          if (asked.delete(req)) done(s);
        };
        const timer = setTimeout(end, STATS_MS, undefined);
        asked.set(req, end);
        transport.post({ t: 'stats', req });
      });
    },
    configure: (config) => transport.post({ t: 'configure', config }),
    dispose() {
      document.removeEventListener('visibilitychange', resumed);
      window.removeEventListener('pageshow', resumed);
      document.removeEventListener('focusin', hint);
      window.removeEventListener('pointerdown', active, true);
      window.removeEventListener('keydown', active, true);
      clearTimeout(idleTimer);
      offPeople();
      privateRows.clear();
      storage.dispose();
      signerAuth.dispose();
      lists.dispose();
      dm.dispose();
      zaps.dispose();
      actions.dispose();
      deliveries.dispose();
      transport.close();
    },
  };
}
