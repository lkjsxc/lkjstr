// Frontend Transport interface. No relay, event parsing or secret handling here.
const HEARTBEAT_INTERVAL_MS = 20_000, HEARTBEAT_TIMEOUT_MS = 60_000;
import { createAvatarReads } from './transport-avatars.js';
const publicSigningActions = new Set([
  'publish', 'follow', 'mute', 'bookmark', 'profile.save', 'relays.save',
  'servers.save', 'channel.join', 'channel.save',
]);
export function workerTransport(options = {}) {
  const client = crypto.randomUUID();
  // Old and new hashed engine graphs may coexist during an atomic release.
  const namespace = `lkjstr-engine-v1:${import.meta.url}`;
  let receive = () => {}, closed = false, port, worker, release, epoch;
  let connection = 0, join;
  let config, relays = options.relayBootstrap ?? (options.relays ? { t: 'relays', relays: options.relays } : undefined), hint;
  const privateSubs = new Map(); // at most 32 private subscriptions
  const subs = new Map(); // bounded by engine's 128-subscription limit
  let started=false, readsReady=false;
  const zapReads = new Map(); // at most 16 finite reads / 64 KiB JSON, released on reconnect/close
  const failedRead = (msg, error) => receive(msg.t === 'zap.quote'
    ? { t: msg.t, req: msg.req, quote: { target: msg.query.target, phase: 'failed', error, recipients: [] } }
    : { t: msg.t, req: msg.req, page: { target: msg.query.target, phase: 'failed', error, coverage: 'failed', page: null } });
  const startup=[]; // at most 64 actions before the first ready
  const pending = new Set(); // bounded by engine's action limit
  const send = (msg, transfer=[]) => port?.postMessage(msg,transfer);
  const avatars = createAvatarReads(send, (message) => receive(message));
  const replay = () => {
    // Read the actual document too: a frozen page may retain its last visible hint.
    const hidden = document.visibilityState === 'hidden' || hint?.hint.pageHidden;
    const restoredHint = hidden ? { t: 'hint', hint: { visibleSubs: [], idle: false, saveData: false, ...hint?.hint, pageHidden: true } } : hint;
    if (restoredHint) send(restoredHint);
    if (config) send(config);
    if (relays) send(relays);
    avatars.replay(hidden);
    for (const state of subs.values()) {
      const visible = !hidden && (hint ? hint.hint.visibleSubs.includes(state.open.sub) : state.open.visible ?? true);
      const open = !visible || state.open.query.privateLists ? { ...state.open, visible } : state.open;
      const window = state.window;
      state.seekPending = window?.anchor?.month !== undefined;
      send(window?.anchor?.key !== undefined ? { ...open, window } : open);
      if (window && window.anchor?.key === undefined && !state.seekPending) send(window);
    }
    if (restoredHint && subs.size) send(restoredHint); // reopened subscriptions now exist for focus routing
    // Direct-message opens retain the same atomic visibility boundary.
    for (const state of privateSubs.values()) {
      send({ ...state.open, visible: state.visible?.visible ?? state.open.visible ?? true });
    }
  };
  const reconnect = () => {
    readsReady=false;
    const lostReads = [...zapReads.values()];
    zapReads.clear();
    for (const msg of started ? lostReads : []) failedRead(msg, 'network');
    if (!started) for (const msg of lostReads) zapReads.set(msg.req, msg);
    for (const req of started ? pending : []) receive({ t: 'result', req, ok: false, error: { code: 'offline' } });
    if(started)pending.clear();
    receive({ t: 'reconnect' });
  };
  const message = (msg, generation = connection) => {
    const live = () => !closed && generation === connection;
    if (!live()) return;
    heartbeatDeadline = performance.now() + HEARTBEAT_TIMEOUT_MS;
    probingAfterPause = false;
    if (msg.t === 'heartbeat') return;
    if (msg.t === 'reconnect') {
      if (!channel) { port.close(); connectShared(); }
      else if (worker) { peers.get(client)?.close(); peers.delete(client); attachLocal(); }
      else { ++connection; epoch = undefined; greet(); }
      reconnect(); return;
    }
    if (msg.t === 'ready') {
      replay();
      if(!started) {started=true;for(const [msg,transfer] of startup.splice(0))send(msg,transfer);}
      if (!readsReady) { readsReady=true; for (const msg of [...zapReads.values()]) send(msg); }
    }
    if (msg.t === 'rows') {
      const reading = subs.get(msg.sub)?.reading;
      if (reading && (reading.key === null || msg.rows.some((r) => r.key === reading.key))) send(reading);
    }
    if (msg.t === 'timeline') {
      const state = subs.get(msg.sub);
      if (state?.seekPending && msg.timeline.supported) {
        state.seekPending = false;
        send(state.window);
      }
    }
    if (msg.t === 'result') pending.delete(msg.req);
    if (msg.t === 'zap.quote' && msg.quote.phase !== 'loading' || msg.t === 'zap.receipts' && msg.page.phase !== 'loading') zapReads.delete(msg.req);
    avatars.receive(msg);
    receive(msg);
  };
  let channel, peers, attachLocal, restartLeader, greet;
  let lastPoll = performance.now(), heartbeatDeadline = lastPoll + HEARTBEAT_TIMEOUT_MS, probingAfterPause = false;
  const connectShared = () => {
    const generation = ++connection;
    const current = new SharedWorker(new URL('shared.js', import.meta.url), { type: 'module', name: namespace });
    const currentPort = current.port;
    worker = current; port = currentPort;
    currentPort.onmessage = (e) => void message(e.data, generation);
    currentPort.start();
    current.onerror = () => {
      if (!closed && generation === connection) {
        currentPort.close(); connectShared(); reconnect();
      }
    };
  };
  if (!options.dedicated && typeof SharedWorker !== 'undefined') connectShared();
  else {
    if (!navigator.locks || !globalThis.BroadcastChannel) throw new Error('Web Locks and BroadcastChannel required');
    channel = new BroadcastChannel(namespace);
    peers = new Map(); // max 32, matching Rust port ownership
    greet = () => {
      join = crypto.randomUUID();
      channel.postMessage({ hello: true, from: client, join });
    };
    const attach = (id, request) => {
      if (!peers.has(id)) {
        if (peers.size >= 32) return;
        const pair = new MessageChannel(), owner = worker, ownerEpoch = epoch;
        peers.set(id, pair.port1);
        pair.port1.onmessage = (e) => {
          if (closed || worker !== owner || epoch !== ownerEpoch || peers.get(id) !== pair.port1) return;
          // Authorization URLs may carry tokens. A BroadcastChannel is not a private port.
          if (e.data.t === 'signer.auth') {
            pair.port1.postMessage({ t: 'signer.auth.cancel', id: e.data.id, reason: 'unsupported' });
            return;
          }
          channel.postMessage({ to: id, epoch: ownerEpoch, msg: e.data });
          if(e.data.t==='reconnect') {pair.port1.close();peers.delete(id);}
        };
        owner.postMessage({ t: 'connect' }, [pair.port2]);
      }
      if (request) channel.postMessage({ to: id, epoch, welcome: true, join: request });
    };
    attachLocal = () => {
      const pair=new MessageChannel(), generation=++connection;
      peers.get(client)?.close();
      peers.set(client,pair.port1);
      pair.port1.onmessage=(e)=>void message(e.data,generation);
      worker.postMessage({t:'connect'},[pair.port2]);
    };
    port = { postMessage: (msg, transfer=[]) => {
      if (worker) {
        if (!peers.has(client)) attachLocal();
        peers.get(client)?.postMessage(msg,transfer);
      } else if (epoch) channel.postMessage({ from: client, epoch, msg:transfer.length?structuredClone(msg,{transfer}):msg });
    } };
    channel.onmessage = (e) => {
      const data = e.data;
      if (closed) return;
      if (data.hello && worker && typeof data.join === 'string' && data.join.length <= 128) attach(data.from, data.join);
      if (data.leader && !worker) greet();
      if (!worker && data.to === client) {
        if (data.welcome && join && data.join === join && typeof data.epoch === 'string') {
          join = undefined;
          if (data.epoch !== epoch) { epoch = data.epoch; ++connection; reconnect(); }
        }
        if (data.msg && epoch && data.epoch === epoch) void message(data.msg, connection);
      }
      if (worker && data.from && data.msg && data.epoch === epoch) {
        attach(data.from);
        peers.get(data.from)?.postMessage(data.msg);
        if (data.msg.t === 'detach') { peers.get(data.from)?.close(); peers.delete(data.from); }
      }
    };
    // The browser releases this exclusive lock when its page dies. No clock lease.
    const abort = new AbortController();
    release = () => abort.abort();
    navigator.locks.request(namespace, { signal: abort.signal }, async () => {
      if (closed) return;
      restartLeader=()=>{
        worker?.terminate();
        for(const peer of peers.values())peer.close();
        peers.clear();
        epoch=crypto.randomUUID(); join=undefined;
        worker=new Worker(new URL('worker.js', import.meta.url),{type:'module'});
        attachLocal();
        channel.postMessage({leader:true,epoch});
        reconnect();
      };
      restartLeader();
      await new Promise((done) => { release = done; });
    }).catch((e) => { if (e.name !== 'AbortError') throw e; });
    if (!worker) greet();
  }
  const heartbeat = setInterval(() => {
    const now = performance.now();
    // Give a delayed page one fresh probe even if its previous deadline passed.
    if (now - lastPoll >= HEARTBEAT_TIMEOUT_MS && !probingAfterPause) {
      heartbeatDeadline = now + HEARTBEAT_TIMEOUT_MS;
      probingAfterPause = true;
    }
    lastPoll = now;
    if (now > heartbeatDeadline) {
      heartbeatDeadline = now + HEARTBEAT_TIMEOUT_MS;
      probingAfterPause = false;
      if (restartLeader) restartLeader();
      else void message({ t: 'reconnect' });
    }
    send({ t: 'heartbeat' });
  }, HEARTBEAT_INTERVAL_MS);
  const resume = () => {
    if (document.visibilityState !== 'visible') return;
    heartbeatDeadline = performance.now() + HEARTBEAT_TIMEOUT_MS;
    send({ t: 'heartbeat' });
    if (channel && !worker) greet();
  };
  document.addEventListener('visibilitychange', resume);
  const close = () => {
    if (closed) return;
    send({ t: 'detach' });
    closed = true;
    clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', resume);
    removeEventListener('pagehide',pagehide);
    removeEventListener('pageshow',pageshow);
    port?.close?.();
    for (const peer of peers?.values() ?? []) peer.close();
    channel?.close();
    worker?.terminate?.();
    release?.();
    privateSubs.clear(); subs.clear(); pending.clear(); zapReads.clear(); avatars.close(); startup.length=0;
  };
  // A retained history page still owns its editor: expiry may orphan it, never certify it clean.
  const pagehide = (event) => { if (!event.persisted) close(); };
  const pageshow = (event) => { if (event.persisted) resume(); };
  addEventListener('pagehide', pagehide);
  addEventListener('pageshow', pageshow);
  return {
    post(msg, transfer=[]) {
      if (closed || avatars.post(msg)) return;
      if (msg.t === 'zap.close' && zapReads.delete(msg.req)) { if (readsReady) send(msg); return; }
      if (msg.t === 'zap.quote' || msg.t === 'zap.receipts') {
        if (zapReads.has(msg.req) || pending.has(msg.req)) return;
        if (zapReads.size >= 16) { failedRead(msg, 'too-large'); return; }
        let queued;
        try {
          const json = JSON.stringify(msg);
          if (!json || json.length > 4096 || new TextEncoder().encode(json).length > 4096) { failedRead(msg, 'too-large'); return; }
          queued = JSON.parse(json); // Own a bounded snapshot, like postMessage itself.
        } catch { failedRead(msg, 'rejected'); return; }
        zapReads.set(msg.req, queued);
        if (readsReady) send(queued);
        return;
      }
      if (!started && (msg.t === 'upload.cancel' || msg.t === 'zap.close')) {
        const kind = msg.t === 'upload.cancel' ? 'upload' : 'zap.invoice';
        const at = startup.findIndex(([action]) => action.t === 'act' && action.req === msg.req && action.action.a === kind);
        if (at >= 0) {
          startup.splice(at, 1);
          pending.delete(msg.req);
          receive({ t: 'result', req: msg.req, ok: false, cancelled: true });
          return;
        }
      }
      if (msg.t === 'dm.open' && (privateSubs.has(msg.sub)||privateSubs.size<32)) privateSubs.set(msg.sub,{open:msg});
      if (msg.t === 'dm.visible' && privateSubs.has(msg.sub)) privateSubs.get(msg.sub).visible=msg;
      if (msg.t === 'dm.close') privateSubs.delete(msg.sub);
      if (msg.t === 'configure') config = msg;
      if (msg.t === 'relays') relays = msg;
      if (msg.t === 'hint') hint = msg;
      if (msg.t === 'open' && (subs.has(msg.sub)||subs.size<128)) subs.set(msg.sub, { open: msg });
      if (msg.t === 'window' && subs.has(msg.sub)) subs.get(msg.sub).window = msg;
      if (msg.t === 'reading') {
        const state = subs.get(msg.sub);
        if (!state || (msg.key !== null && (typeof msg.key !== 'string' || msg.key.length > 256))) return;
        state.reading = { t: 'reading', sub: msg.sub, key: msg.key };
      }
      if (msg.t === 'close') subs.delete(msg.sub);
      if (msg.t === 'act') {
        if(pending.has(msg.req)||zapReads.has(msg.req))return;
        if(pending.size>=64) {receive({t:'result',req:msg.req,ok:false,error:{code:'internal'}});return;}
        pending.add(msg.req);
        if (publicSigningActions.has(msg.action.a)) {
          msg = { ...msg, signingTiming: {
            at: performance.timeOrigin + performance.now(),
            hidden: document.visibilityState === 'hidden',
            boot: !started,
            restart: started && !readsReady,
          } };
        }
        if(!started) {startup.push([msg,transfer]);return;}
      }
      send(msg,transfer);
    },
    listen(fn) { receive = fn; },
    close,
  };
}
// Same handle/dispose factory shape as engine/mock/engine.ts, for direct hosts.
export function createMockEngine(post) {
  const transport = workerTransport();
  transport.listen(post);
  return { handle: (msg) => transport.post(msg), dispose: () => transport.close() };
}
