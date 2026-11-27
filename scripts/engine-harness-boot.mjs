import { setTimeout as delay } from 'node:timers/promises';

// Serve Worker code directly: fulfilled Worker scripts reject sockets in this test runtime.
const boot = `
import init, { start } from './lkjstr_engine.js';
let uploadClock = 0;
const realNow = performance.now.bind(performance);
Object.defineProperty(performance, 'now', { value: () => realNow() + uploadClock });
const queued = [];
self.onmessage = event => queued.push(event);
await init();
self.engineHandle = start();
const input = self.onmessage;
self.onmessage = event => {
  const { data } = event;
  if (data.t === 'test.uploadClock') uploadClock = data.ms;
  else if (data.t === 'test.advance') self.engineHandle.advance_time(data.ms);
  else if (data.t === 'test.relays') self.engineHandle.set_test_relays(data.relays);
  else if (data.t === 'test.ticks') {
    const [reply] = event.ports;
    reply.postMessage(self.engineHandle.tick_count());
    reply.close();
  } else input(event);
};
for (const event of queued) self.onmessage(event);
`;
export function workerBoot(path, origin) {
  if (path === "/worker.js") return boot;
  const allowed = JSON.stringify(origin.replace("http:", "ws:"));
  const guard = `const ArchiveWebSocket=globalThis.WebSocket;globalThis.WebSocket=class extends ArchiveWebSocket{constructor(url,protocols){if(new URL(url).origin!==${allowed})throw new Error('archive fixture blocked non-loopback relay');super(url,protocols);}};`;
  return guard + boot;
}

// Sample the real Worker counter after visibility releases its socket.
export async function checkIdleTicks(page, check) {
  const ticks = () => page.evaluate(() => new Promise((resolve, reject) => {
    // Keep test replies out of the array validated against the release protocol.
    const { port1, port2 } = new MessageChannel();
    const deadline = setTimeout(() => {
      port1.close();
      reject(new Error('Worker tick counter did not answer'));
    }, 5000);
    port1.onmessage = ({ data }) => {
      clearTimeout(deadline);
      port1.close();
      resolve(data);
    };
    window.worker.postMessage({ t: 'test.ticks' }, [port2]);
  }));
  const start = await ticks();
  const started = performance.now();
  await delay(3000);
  const end = await ticks();
  const elapsed = performance.now() - started;
  const turnsPerSecond = (end - start) * 1000 / elapsed;
  check('a hidden Worker uses at most four turns per second', turnsPerSecond <= 4);
}

export async function noteOutboxProtocol(send, wait) {
  const key = '01423456-1234-1234-1234-123456789abc';
  await send({t:'note.outbox',keys:[key]});
  await wait(key=>window.messages.some(m=>m.t==='note.outbox'&&m.keys.includes(key)&&m.statuses.length===0),key);
  await send({t:'note.discard',key});
  await send({t:'note.wake'});
}
