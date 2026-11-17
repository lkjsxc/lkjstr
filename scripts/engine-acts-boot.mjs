// Guard is served as the Worker entrypoint before any production import executes.
export const actsLnurl = 'https://zap.fixture.invalid/.well-known/lnurlp/receiver';
export function actsBoot(module) {
  return `const queued=[];self.onmessage=e=>{if(queued.length>=128)throw Error('owned bootstrap queue bound');queued.push(e);};
const deny=kind=>{self.postMessage({t:'fixture.guard',kind});throw Error('blocked non-owned '+kind);};
const NativeSocket=self.WebSocket,allowed=self.location.origin.replace('http:','ws:');
self.WebSocket=class extends NativeSocket{constructor(url,...rest){const u=new URL(url);if(u.origin!==allowed||u.pathname!=='/relay'||u.search||u.hash)deny('socket');super(url,...rest);}send(text){const m=JSON.parse(text);if(!['REQ','CLOSE'].includes(m[0]))deny('publication');super.send(text);}};
const nativeFetch=self.fetch;self.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location.href);if(url.origin!==self.location.origin&&url.href!==${JSON.stringify(actsLnurl)})deny('http');return nativeFetch(input,options);};
const {default:init,start}=await import(${JSON.stringify(module)});await init();self.handle=start();const input=self.onmessage;for(const event of queued)input(event);queued.length=0;`;
}
export function actsPage() {
  const fail = reason => { if (window.acts.errors.length < 20) window.acts.errors.push(reason); };
  window.acts = { rows: {}, states: {}, quotes: {}, counts: {}, errors: [], guards: [], signerRequests: 0, messages: 0 };
  window.actsWorker = new Worker('/worker.js', { type: 'module' });
  window.actsWorker.onerror = event => fail('Worker: ' + event.message);
  window.actsWorker.onmessage = event => {
    const message = event.data, state = window.acts;
    if (++state.messages > 10000) { fail('owned message bound'); window.actsWorker.terminate(); return; }
    if (!state.counts[message.t] && Object.keys(state.counts).length >= 64) return fail('owned message type bound');
    state.counts[message.t] = (state.counts[message.t] ?? 0) + 1;
    if (message.t === 'ready') state.ready = message;
    if (message.t === 'fixture.guard') { if (state.guards.length < 20) state.guards.push(message.kind); return; }
    if (['sign', 'crypt', 'getPublicKey', 'private.crypt', 'private.sign'].includes(message.t)) state.signerRequests++;
    if (message.t === 'zap.quote') {
      if (Object.keys(state.quotes).length >= 8 && !state.quotes[message.req]) return fail('owned quote bound');
      state.quotes[message.req] = message.quote;
    }
    const sub = message.sub;
    if (typeof sub !== 'string' || !['rows', 'patch', 'state'].includes(message.t)) return;
    if (Object.keys(state.rows).length >= 16 && !state.rows[sub]) return fail('owned source bound');
    state.rows[sub] ??= [];
    if (message.t === 'state') state.states[sub] = message.state;
    if (message.t === 'rows') state.rows[sub] = message.rows;
    if (message.t === 'patch') for (const op of message.ops) {
      if (op.op === 'remove') state.rows[sub] = state.rows[sub].filter(row => row.key !== op.key);
      if (op.op === 'update') state.rows[sub] = state.rows[sub].map(row => row.key === op.row.key ? op.row : row);
      if (op.op === 'insert') {
        const index = op.before === null ? state.rows[sub].length : state.rows[sub].findIndex(row => row.key === op.before);
        state.rows[sub].splice(index < 0 ? state.rows[sub].length : index, 0, ...op.rows);
      }
    }
    if (state.rows[sub].length > 256) { fail('owned projected-row bound'); state.rows[sub] = state.rows[sub].slice(0, 256); }
  };
}
