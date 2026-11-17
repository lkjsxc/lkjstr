// Same small read-only trampoline on both clients; original release bytes stay untouched.
export function installReadonly({ relayAllowlist = null } = {}) {
  if (globalThis.__openRaceGuard) return;
  const state = globalThis.__openRaceGuard = { forbidden: 0, sent: 0, received: 0, workers: 0, firstEventEpoch: null };
  state.deniedConnections = 0; state.deniedUrls = []; state.openedQueries = []; state.windows = [];
  const allowed = relayAllowlist ? new Set(relayAllowlist.map(url => new URL(url).href)) : null;
  const Native = globalThis.WebSocket;
  if (Native) {
    const send = Native.prototype.send;
    Native.prototype.send = function (raw) {
      let frame;
      try { frame = JSON.parse(String(raw)); } catch { state.forbidden++; throw Error('Race rejects non-JSON WebSocket writes'); }
      if (!Array.isArray(frame) || !['REQ', 'CLOSE', 'COUNT', 'NEG-OPEN', 'NEG-MSG', 'NEG-CLOSE'].includes(frame[0])) {
        state.forbidden++; throw Error('Race rejects WebSocket writes other than read requests');
      }
      state.sent++;
      return send.call(this, raw);
    };
    globalThis.WebSocket = new Proxy(Native, { construct(target, args, newTarget) {
      if (allowed) {
        const url = new URL(String(args[0]), globalThis.location?.href).href;
        if (!allowed.has(url)) {
          state.deniedConnections++; if (state.deniedUrls.length < 128 && !state.deniedUrls.includes(url)) state.deniedUrls.push(url);
          throw Error('Read-score relay outside recorded candidate scope');
        }
      }
      const socket = Reflect.construct(target, args, newTarget);
      socket.addEventListener('message', (event) => {
        state.received++; state.firstReplyEpoch ??= performance.timeOrigin + performance.now();
        if (typeof event.data === 'string' && /^\s*\[\s*"EVENT"\s*,/.test(event.data))
          state.firstEventEpoch ??= performance.timeOrigin + performance.now();
      });
      return socket;
    } });
  }
  const blobs = new Map(); // At most 32 distinct worker definitions per owned page.
  for (const name of ['Worker', 'SharedWorker']) {
    const Constructor = globalThis[name];
    if (!Constructor) continue;
    globalThis[name] = new Proxy(Constructor, { construct(target, args, newTarget) {
      const source = new URL(String(args[0]), globalThis.document?.baseURI ?? location.href);
      if (!['https:', 'http:'].includes(source.protocol) || source.origin !== location.origin)
        throw Error('Race only permits same-origin release workers');
      const options = typeof args[1] === 'string' ? { name: args[1] } : args[1] ?? {};
      const key = JSON.stringify([source.href, options.type ?? 'classic', options.name ?? '']);
      let blob = blobs.get(key);
      if (!blob) {
        if (blobs.size === 32) throw Error('Race worker-definition limit');
        const kind = name === 'SharedWorker' ? 'connect' : 'message';
        const install = '(' + installReadonly.toString() + ')(' + JSON.stringify({ relayAllowlist }) + ');\n';
        const queue = 'const pending=[];const capture=e=>{e.stopImmediatePropagation();' +
          'if(pending.length>=128)throw Error("Race worker queue full");pending.push(e);};' +
          'self.addEventListener(' + JSON.stringify(kind) + ',capture);\n';
        const load = options.type === 'module' ? 'await import(' + JSON.stringify(source.href) + ');'
          : 'importScripts(' + JSON.stringify(source.href) + ');';
        const release = '\nself.removeEventListener(' + JSON.stringify(kind) + ',capture);' +
          'for(const e of pending)self.dispatchEvent(new MessageEvent(' + JSON.stringify(kind) +
          ',{data:e.data,origin:e.origin,lastEventId:e.lastEventId,source:e.source,ports:e.ports}));';
        blob = URL.createObjectURL(new Blob([install, queue, load, release], { type: 'text/javascript' }));
        blobs.set(key, blob);
      }
      state.workers++;
      const worker = Reflect.construct(target, [blob, options], newTarget);
      const port = name === 'SharedWorker' ? worker.port : worker;
      const post = port.postMessage;
      if (typeof post === 'function') port.postMessage = function (message, ...rest) {
        if (message?.t === 'open' && state.openedQueries.length < 128) state.openedQueries.push({sub:message.sub,query:message.query});
        if (message?.t === 'window' && state.windows.length < 256) state.windows.push({sub:message.sub,anchor:message.anchor,before:message.before,after:message.after});
        return post.call(this,message,...rest);
      };
      port.addEventListener('message', (event) => {
        if (event.data?.t === 'ready' && globalThis.document)
          state.engineReadyMs ??= performance.now();
      });
      return worker;
    } });
  }
}
