// The interface's side of the protocol: subscriptions with their handlers, actions as promises, and the hints the
// engine cannot see for itself. One client per page; the engine behind it is a Worker (real or mock).
import { createSignal, type Signal } from '../shared/signal.ts';
import type {
  Account,
  Action,
  Anchor,
  Delivery,
  EngineConfig,
  EngineStats,
  FromEngine,
  Hint,
  PatchOp,
  Pubkey,
  Query,
  Row,
  SubState,
  Timeline,
  ToEngine,
} from './protocol.ts';

export type Transport = {
  post(msg: ToEngine, transfer?: Transferable[]): void;
  listen(fn: (msg: FromEngine) => void): void;
  close(): void;
};
export function workerTransport(url: string): Transport {
  const worker = new Worker(url, { type: 'module', name: 'lkjstr-engine' });
  return {
    post: (msg, transfer) => worker.postMessage(msg, transfer ?? []),
    listen: (fn) => void (worker.onmessage = (e: MessageEvent<FromEngine>) => fn(e.data)),
    close: () => worker.terminate(),
  };
}

export type SubHandlers = {
  rows(rows: readonly Row[], atTop: boolean, atBottom: boolean): void;
  patch(ops: readonly PatchOp[]): void;
  fresh?(count: number): void;
  timeline?(timeline: Timeline): void;
  state?(state: SubState): void;
};
export type Subscription = {
  readonly id: string;
  near(ids: readonly string[]): void;
  window(anchor: Anchor, before: number, after: number): void;
  /** Whether its tab is in front (the engine may pause what is not). */
  visible(on: boolean): void;
  close(): void;
};
export type ActResult = Extract<FromEngine, { t: 'result' }>;
export type ActWatch = {
  progress?(sent: number, total: number): void;
  delivery?(relays: readonly Delivery[]): void;
};
export type Accounts = { readonly accounts: readonly Account[]; readonly active?: Pubkey };
export type Engine = {
  readonly accounts: Signal<Accounts>;
  readonly status: Signal<{ connected: number; wanted: number; offline: boolean }>;
  /** Which engine answered (`null` until it is ready). */
  readonly info: Signal<{ engine: string; version: number } | null>;
  /** The active account's pubkey ('' when signed out). */
  me(): Pubkey;
  open(query: Query, handlers: SubHandlers): Subscription;
  act(action: Action, watch?: ActWatch): Promise<ActResult>;
  /** What the engine measured about itself, now. Undefined: this engine did not answer (it keeps no statistics). */
  stats(): Promise<EngineStats | undefined>;
  configure(config: EngineConfig): void;
  dispose(): void;
};

type Nip07 = { signEvent(event: unknown): Promise<unknown>; getPublicKey?(): Promise<unknown> };
const IDLE_MS = 180_000;
const STATS_MS = 4000;

export function createEngine(transport: Transport): Engine {
  const subs = new Map<string, SubHandlers>(); // bound: open subscriptions (one per mounted list)
  const pending = new Map<string, { done(r: ActResult): void; watch?: ActWatch }>(); // bound: actions in flight
  const visible = new Set<string>(); // bound: as `subs`
  const asked = new Map<string, (s: EngineStats | undefined) => void>(); // bound: `stats` requests in flight
  const accounts = createSignal<Accounts>({ accounts: [] });
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
          pageHidden: document.visibilityState === 'hidden',
          idle,
          saveData: net?.saveData === true,
          effectiveType: net?.effectiveType,
          deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
        },
      });
    });
  };
  const active = (): void => {
    if (idle) (idle = false), hint();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ((idle = true), hint()), IDLE_MS);
  };
  document.addEventListener('visibilitychange', hint);
  window.addEventListener('pointerdown', active, { passive: true, capture: true });
  window.addEventListener('keydown', active, { passive: true, capture: true });
  active();

  const sign = async (msg: Extract<FromEngine, { t: 'sign' }>): Promise<void> => {
    const ext = (window as { nostr?: Nip07 }).nostr;
    try {
      if (!ext) throw new Error('no signer extension');
      const event = JSON.stringify(await ext.signEvent(JSON.parse(msg.event)));
      transport.post({ t: 'signed', req: msg.req, event });
    } catch (e) {
      transport.post({ t: 'signed', req: msg.req, error: String((e as Error).message ?? e) });
    }
  };

  /** The real engine's transport answers this itself; the mock asks through here. */
  const publicKey = async (req: string): Promise<void> => {
    const ext = (window as { nostr?: Nip07 }).nostr;
    if (!ext?.getPublicKey) return transport.post({ t: 'publicKey', req, error: 'signer-missing' });
    try {
      transport.post({ t: 'publicKey', req, pubkey: String(await ext.getPublicKey()) });
    } catch {
      transport.post({ t: 'publicKey', req, error: 'signer-refused' });
    }
  };

  transport.listen((msg) => {
    if (msg.t === 'rows') subs.get(msg.sub)?.rows(msg.rows, msg.atTop, msg.atBottom);
    else if (msg.t === 'timeline') subs.get(msg.sub)?.timeline?.(msg.timeline);
    else if (msg.t === 'patch') subs.get(msg.sub)?.patch(msg.ops);
    else if (msg.t === 'fresh') subs.get(msg.sub)?.fresh?.(msg.count);
    else if (msg.t === 'state') subs.get(msg.sub)?.state?.(msg.state);
    else if (msg.t === 'progress') pending.get(msg.req)?.watch?.progress?.(msg.sent, msg.total);
    else if (msg.t === 'delivery') pending.get(msg.req)?.watch?.delivery?.(msg.relays);
    else if (msg.t === 'result') {
      pending.get(msg.req)?.done(msg);
      pending.delete(msg.req);
    } else if (msg.t === 'accounts') accounts.set({ accounts: msg.accounts, active: msg.active });
    else if (msg.t === 'status')
      status.set({ connected: msg.connected, wanted: msg.wanted, offline: msg.offline });
    else if (msg.t === 'ready') info.set({ engine: msg.engine, version: msg.version });
    else if (msg.t === 'stats') asked.get(msg.req)?.(msg.stats);
    else if (msg.t === 'sign') void sign(msg);
    else if (msg.t === 'getPublicKey') void publicKey(msg.req);
  });

  return {
    accounts,
    status,
    info,
    me: () => accounts.get().active ?? '',
    open(query, handlers) {
      const id = `s${++serial}`;
      subs.set(id, handlers);
      transport.post({ t: 'open', sub: id, query });
      return {
        id,
        near: (ids) => {
          if ((info.get()?.version ?? 0) >= 5) transport.post({ t: 'preview', sub: id, ids });
        },
        window: (anchor, before, after) =>
          transport.post({
            t: 'window',
            sub: id,
            anchor,
            before,
            after,
            // Protocol 3 retains up to 6000 cached rows already read. An 800-row moving window otherwise
            // discards the beginning while paging down, making a return to the top fetch and jump.
            ...(anchor !== 'top' && before > 0 && (info.get()?.version ?? 0) >= 3
              ? { retainAbove: true }
              : {}),
          }),
        visible(on) {
          if (on === visible.has(id)) return;
          if (on) visible.add(id);
          else visible.delete(id);
          hint();
        },
        close() {
          if (!subs.delete(id)) return;
          visible.delete(id);
          transport.post({ t: 'close', sub: id });
        },
      };
    },
    act(action, watch) {
      const req = `r${++serial}`;
      return new Promise((done) => {
        pending.set(req, { done, watch });
        transport.post(
          { t: 'act', req, action },
          action.a === 'upload' ? [action.bytes] : undefined,
        );
      });
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
      document.removeEventListener('visibilitychange', hint);
      window.removeEventListener('pointerdown', active, true);
      window.removeEventListener('keydown', active, true);
      clearTimeout(idleTimer);
      transport.close();
    },
  };
}
