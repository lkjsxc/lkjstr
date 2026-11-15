// Frontend Transport interface. No relay, event parsing or secret handling here.
export function workerTransport(options = {}) {
  const client = crypto.randomUUID();
  // Old and new hashed engine graphs may coexist during an atomic release.
  const namespace = `lkjstr-engine-v1:${import.meta.url}`;
  let receive = () => {}, closed = false, port, worker, release, epoch;
  let config, relays = options.relays ? { t: 'relays', relays: options.relays } : undefined, hint;
  const subs = new Map(); // bounded by engine's 128-subscription limit
  let started=false;
  const startup=[]; // at most 64 actions before the first ready
  const pending = new Set(); // bounded by engine's action limit
  const send = (msg, transfer=[]) => port?.postMessage(msg,transfer);
  const replay = () => {
    if (config) send(config);
    if (relays) send(relays);
    for (const { open, window } of subs.values()) {
      send(open);
      if (window) send(window);
    }
    if (hint) send(hint);
  };
  const reconnect = () => {
    for (const req of started ? pending : []) receive({ t: 'result', req, ok: false, error: { code: 'offline' } });
    if(started)pending.clear();
    receive({ t: 'reconnect' });
    replay();
  };
  const message = async (msg) => {
    if (closed) return;
    lastAlive=performance.now();
    if (msg.t === 'heartbeat') return;
    if (msg.t === 'reconnect') {
      if (!channel) { port.close(); connectShared(); }
      else if (worker) { peers.get(client)?.close(); peers.delete(client); attachLocal(); }
      else channel.postMessage({ hello: true, from: client });
      reconnect(); return;
    }
    if (msg.t === 'getPublicKey') {
      try {
        if (!globalThis.nostr?.getPublicKey) throw new Error('signer-missing');
        const pubkey = await globalThis.nostr.getPublicKey();
        send({ t: 'publicKey', req: msg.req, pubkey });
      } catch (e) {
        send({ t: 'publicKey', req: msg.req, error: e.message === 'signer-missing' ? 'signer-missing' : 'signer-refused' });
      }
      return;
    }
    if (msg.t === 'ready') {
      replay();
      if(!started) {started=true;for(const [msg,transfer] of startup.splice(0))send(msg,transfer);}
    }
    if (msg.t === 'result') pending.delete(msg.req);
    receive(msg);
  };
  const url = (name) => new URL(name, import.meta.url);
  let channel, peers, attachLocal, restartLeader;
  let lastAlive=performance.now();
  const connectShared = () => {
    worker = new SharedWorker(url('shared.js'), { type: 'module', name: namespace });
    port = worker.port;
    port.onmessage = (e) => void message(e.data);
    port.start();
    worker.onerror = () => { if (!closed) { port.close(); connectShared(); reconnect(); } };
  };
  if (!options.dedicated && typeof SharedWorker !== 'undefined') connectShared();
  else {
    if (!navigator.locks || !globalThis.BroadcastChannel) throw new Error('Web Locks and BroadcastChannel required');
    channel = new BroadcastChannel(namespace);
    peers = new Map(); // max 32, matching Rust port ownership
    const attach = (id) => {
      if (peers.has(id)) return;
      if (peers.size >= 32) return;
      const pair = new MessageChannel();
      peers.set(id, pair.port1);
      pair.port1.onmessage = (e) => {
        channel.postMessage({ to: id, epoch, msg: e.data });
        if(e.data.t==='reconnect') {pair.port1.close();peers.delete(id);}
      };
      worker.postMessage({ t: 'connect' }, [pair.port2]);
      channel.postMessage({ to: id, epoch, welcome: true });
    };
    attachLocal = () => {
      const pair=new MessageChannel();
      peers.set(client,pair.port1);
      pair.port1.onmessage=(e)=>void message(e.data);
      worker.postMessage({t:'connect'},[pair.port2]);
    };
    port = { postMessage: (msg, transfer=[]) => {
      if (worker) {
        attach(client);
        peers.get(client)?.postMessage(msg,transfer);
      } else channel.postMessage({ from: client, epoch, msg:transfer.length?structuredClone(msg,{transfer}):msg });
    } };
    channel.onmessage = (e) => {
      const data = e.data;
      if (data.hello && worker) attach(data.from);
      if (data.leader) { channel.postMessage({ hello: true, from: client }); }
      if (data.to === client) {
        if (data.welcome && data.epoch !== epoch) { epoch = data.epoch; reconnect(); }
        if (data.msg) void message(data.msg);
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
        epoch=crypto.randomUUID();
        worker=new Worker(url('worker.js'),{type:'module'});
        attachLocal();
        channel.postMessage({leader:true,epoch});
        reconnect();
      };
      restartLeader();
      await new Promise((done) => { release = done; });
    }).catch((e) => { if (e.name !== 'AbortError') throw e; });
    channel.postMessage({ hello: true, from: client });
  }
  const heartbeat = setInterval(() => {
    if(performance.now()-lastAlive>60_000) {
      lastAlive=performance.now();
      if(restartLeader)restartLeader();
      else void message({t:'reconnect'});
    }
    send({t:'heartbeat'});
  },20_000);
  const resume = () => { if (document.visibilityState === 'visible') { send({ t: 'heartbeat' }); if (channel) channel.postMessage({ hello: true, from: client }); } };
  document.addEventListener('visibilitychange', resume);
  const close = () => {
    if (closed) return;
    send({ t: 'detach' });
    closed = true;
    clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', resume);
    removeEventListener('pagehide',close);
    port?.close?.();
    for (const peer of peers?.values() ?? []) peer.close();
    channel?.close();
    worker?.terminate?.();
    release?.();
    subs.clear(); pending.clear(); startup.length=0;
  };
  addEventListener('pagehide', close, { once: true });
  return {
    post(msg, transfer=[]) {
      if (closed) return;
      if (msg.t === 'configure') config = msg;
      if (msg.t === 'relays') relays = msg;
      if (msg.t === 'hint') hint = msg;
      if (msg.t === 'open' && (subs.has(msg.sub)||subs.size<128)) subs.set(msg.sub, { open: msg });
      if (msg.t === 'window' && subs.has(msg.sub)) subs.get(msg.sub).window = msg;
      if (msg.t === 'close') subs.delete(msg.sub);
      if (msg.t === 'act') {
        if(pending.size>=64) {receive({t:'result',req:msg.req,ok:false,error:{code:'internal'}});return;}
        pending.add(msg.req);
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
