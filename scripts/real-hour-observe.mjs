// Measurement-only probes, installed through CDP before each release target runs.
// No signer exists in the fresh profile. REQ/CLOSE is an additional fail-closed guard.
export function observeRelease() {
  if (globalThis.__realHour) return;
  const state = globalThis.__realHour = {
    started: Date.now(), offline: false, forbidden: 0, sent: 0, received: 0,
    connects: 0, closes: 0, frames: 0, longFrames: 0, stalls: 0, maxFrameMs: 0,
    evidenceDropped: { ids: 0, sourceMappings: 0, views: 0 }, seenDropped: {},
    queries: [], queryLogDropped: 0, queryFilterCharacters: 0, sources: {}, seen: {}, first: {}, errors: [], views: {},
  };
  const live = new Set(); // Active sockets only; removed on close.
  const filterIntern = new Map(); // <=1024 immutable filters, <=4 Mi characters of keys.
  const Native = globalThis.WebSocket;
  if (Native) {
    const send = Native.prototype.send;
    Native.prototype.send = function (raw) {
      let message;
      try { message = JSON.parse(String(raw)); } catch { state.forbidden++; throw Error('read-only guard: malformed frame'); }
      if (!['REQ', 'CLOSE'].includes(message[0])) {
        state.forbidden++;
        throw Error(`read-only guard: ${String(message[0]).slice(0, 20)}`);
      }
      if (state.offline) throw new DOMException('Measured network outage', 'NetworkError');
      const previous = this.__hourQueries?.get(message[1]);
      if (previous) { previous.closedAt = Date.now(); previous.closeReason = message[0] === 'REQ' ? 'replaced' : 'client-close'; }
      if (message[0] === 'REQ') {
        this.__hourSubs?.add(message[1]);
        const filters = message.slice(2), key = JSON.stringify(filters);
        if (!filterIntern.has(key) && filterIntern.size < 1024 && state.queryFilterCharacters + key.length <= 4 * 1024 * 1024) {
          filterIntern.set(key, filters); state.queryFilterCharacters += key.length;
        }
        const query = { at: Date.now(), relay: this.url, subscription: message[1], filters: filterIntern.get(key) ?? filters };
        if (state.queries.length < 10000 && filterIntern.has(key)) state.queries.push(query);
        else state.queryLogDropped++;
        if (this.__hourQueries.size < 128 || this.__hourQueries.has(message[1])) this.__hourQueries.set(message[1], query);
      } else { this.__hourSubs?.delete(message[1]); this.__hourQueries?.delete(message[1]); }
      state.sent++;
      return send.call(this, raw);
    };
    globalThis.WebSocket = new Proxy(Native, { construct(target, args) {
      if (state.offline) throw new DOMException('Measured network outage', 'NetworkError');
      const socket = new target(...args);
      socket.__hourSubs = new Set();
      socket.__hourQueries = new Map();
      state.connects++;
      live.add(socket);
      socket.addEventListener('message', (event) => {
        state.received++;
        if (!/^\s*\[\s*"(?:EOSE|CLOSED)"/.test(String(event.data))) return;
        try {
          const [type, id] = JSON.parse(String(event.data)), query = socket.__hourQueries.get(id);
          if (query && type === 'EOSE') query.eoseAt ??= Date.now();
          if (type === 'CLOSED') {
            socket.__hourSubs.delete(id);
            if (query) { query.closedAt = Date.now(); query.closeReason = 'relay-closed'; socket.__hourQueries.delete(id); }
          }
        } catch { /* Malformed relay replies remain the engine's responsibility. */ }
      });
      socket.addEventListener('close', () => {
        for (const query of socket.__hourQueries.values()) { query.closedAt = Date.now(); query.closeReason = 'socket-close'; }
        socket.__hourQueries.clear(); live.delete(socket); state.closes++;
      });
      return socket;
    } });
  }
  globalThis.__realHourNetwork = (online) => {
    state.offline = !online;
    if (!online) for (const socket of live) socket.close();
    if (globalThis.document) dispatchEvent(new Event(online ? 'online' : 'offline'));
  };
  const ensureView = (source) => {
    if (typeof source !== 'string') return false;
    if (source in state.views) return true;
    if (Object.keys(state.views).length >= 128) { state.evidenceDropped.views++; return false; }
    state.views[source] = {}; return true;
  };
  const seenSets = new Map(); // <=128 sources; at most 40000 public IDs each.
  const remember = (source, row) => {
    const ids = state.seen[source] ??= [];
    if (!seenSets.has(source)) seenSets.set(source, new Set());
    const seen = seenSets.get(source);
    const add = (id) => {
      if (!id || seen.has(id)) return;
      if (ids.length >= 40000) {
        state.evidenceDropped.ids++; state.seenDropped[source] = (state.seenDropped[source] ?? 0) + 1; return;
      }
      seen.add(id); ids.push(id);
    };
    if (row.kind === 'note') { add(row.id); add(row.key); }
    if (row.kind === 'notification') { add(row.key); add(row.note?.id); }
    const note = row.kind === 'notification' ? row.note : row;
    if (note?.kind !== 'note') return;
    const first = state.first[source] ??= {};
    first.noteMs ??= performance.now();
    if (note.author?.name && !/^(npub1|[0-9a-f]{64}$)/.test(note.author.name)) first.nameMs ??= performance.now();
    if (note.author?.picture) first.pictureMetadataMs ??= performance.now();
  };
  const receive = (data) => {
    const msg = data?.msg ?? data;
    if (!msg || typeof msg !== 'object' || !['rows', 'state', 'patch'].includes(msg.t)) return;
    const source = state.sources[msg.sub] ?? msg.sub;
    if (!ensureView(source)) return;
    if (msg.t === 'rows') {
      state.views[source] = { ...(state.views[source] ?? {}), atTop: msg.atTop, atBottom: msg.atBottom, rows: msg.rows?.length, first: msg.rows?.[0]?.at, last: msg.rows?.at(-1)?.at };
      for (const row of msg.rows ?? []) remember(source, row);
    }
    if (msg.t === 'state') state.views[source] = { ...(state.views[source] ?? {}), state: msg.state };
    if (msg.t === 'patch') for (const op of msg.ops ?? []) {
      if (op.row) remember(source, op.row);
      for (const row of op.rows ?? []) remember(source, row);
    }
  };
  for (const type of [globalThis.MessagePort, globalThis.Worker, globalThis.BroadcastChannel].filter(Boolean)) {
    const prototype = type.prototype;
    const post = prototype.postMessage;
    if (post) prototype.postMessage = function (msg, ...args) {
      const data = msg?.msg ?? msg;
      if (data?.t === 'open') {
        const source = data.query?.source;
        if (data.sub in state.sources || Object.keys(state.sources).length < 128) state.sources[data.sub] = source;
        else state.evidenceDropped.sourceMappings++;
        if (ensureView(source)) state.views[source] = { ...state.views[source], query: data.query };
      }
      if (data?.t === 'close') delete state.sources[data.sub];
      if (data?.t === 'window') {
        const source = state.sources[data.sub] ?? data.sub;
        if (ensureView(source)) state.views[source] = { ...state.views[source], window: data };
      }
      return post.call(this, msg, ...args);
    };
    const property = Object.getOwnPropertyDescriptor(prototype, 'onmessage');
    if (property?.set) Object.defineProperty(prototype, 'onmessage', { ...property, set(fn) {
      return property.set.call(this, typeof fn === 'function' ? (event) => { receive(event.data); return fn.call(this, event); } : fn);
    } });
  }
  if (globalThis.document) {
    let previous;
    const frame = (time) => {
      if (previous !== undefined && document.visibilityState === 'visible') {
        const elapsed = time - previous;
        state.frames++;
        if (elapsed > 34) state.longFrames++;
        if (elapsed > 100) state.stalls++;
        state.maxFrameMs = Math.max(state.maxFrameMs, elapsed);
      }
      previous = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    addEventListener('error', (event) => { if (state.errors.length < 20) state.errors.push(String(event.message).slice(0, 300)); });
  }
  globalThis.__realHourSnapshot = () => ({
    ...state, queries: undefined, seen: undefined,
    seenCounts: Object.fromEntries(Object.entries(state.seen).map(([key, ids]) => [key, ids.length])),
    sockets: [...live].map((socket) => ({ url: socket.url, readyState: socket.readyState, subscriptions: socket.__hourSubs.size })),
  });
}
