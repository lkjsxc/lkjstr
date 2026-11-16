// Serve Worker code directly: fulfilled Worker scripts reject sockets in this test runtime.
const boot = `let uploadClock=0;const realNow=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>realNow()+uploadClock});import init,{start} from './lkjstr_engine.js'; const queued=[];self.onmessage=e=>queued.push(e);await init(); self.engineHandle=start();const input=self.onmessage;self.onmessage=e=>{if(e.data.t==='test.uploadClock')uploadClock=e.data.ms;else if(e.data.t==='test.advance')self.engineHandle.advance_time(e.data.ms);else if(e.data.t==='test.relays')self.engineHandle.set_test_relays(e.data.relays);else input(e);};for(const e of queued)self.onmessage(e);`;
export function workerBoot(path, origin) {
  if (path === "/worker.js") return boot;
  const allowed = JSON.stringify(origin.replace("http:", "ws:"));
  const guard = `const ArchiveWebSocket=globalThis.WebSocket;globalThis.WebSocket=class extends ArchiveWebSocket{constructor(url,protocols){if(new URL(url).origin!==${allowed})throw new Error('archive fixture blocked non-loopback relay');super(url,protocols);}};`;
  return guard + boot;
}
