// Fresh signed public events only; no key or upstream relay leaves this helper.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
export async function historyFixture() {
  const bin = resolve(process.env.LKJSTR_ENGINE_FIXTURE_BIN ?? join(process.env.CARGO_TARGET_DIR ?? 'target', 'debug/examples/engine-fixtures'));
  const child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const exited = new Promise(ok => { child.once('exit', ok); child.once('error', ok); });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  async function read() {
    let timer;
    try {
      return JSON.parse((await Promise.race([lines.next(), new Promise((_, bad) => {
        timer = setTimeout(() => bad(new Error('owned signer timeout')), 5000);
      })])).value);
    } finally { clearTimeout(timer); }
  }
  async function close() {
    child.stdin.end();
    let timer;
    try { await Promise.race([exited, new Promise(ok => { timer = setTimeout(() => { child.kill('SIGKILL'); ok(); }, 2000); })]); }
    finally { clearTimeout(timer); await exited; }
  }
  try {
    const { note } = await read(), events = [], start = Math.floor(Date.now() / 1000) - 1000;
    for (let index = 0; index < 201; index++) {
      child.stdin.write(JSON.stringify({pubkey:note.pubkey,created_at:start-index,kind:1,tags:[],content:'owned history '+index})+'\n');
      events.push(await read());
    }
    await close();
    return { events, pubkey:note.pubkey, bin };
  } catch (error) { await close(); throw error; }
}
const matches = (e, f) => (!f.authors || f.authors.includes(e.pubkey)) &&
  (!f.kinds || f.kinds.includes(e.kind)) && (!f.ids || f.ids.includes(e.id)) &&
  (!f.since || e.created_at >= f.since) && (!f.until || e.created_at <= f.until) &&
  !Object.keys(f).some(key => key.startsWith('#'));
export function historyRoutes(events, trace) {
  const timers = new Set(), sockets = new Set(), errors = [];
  let head, tail;
  function route(socket, request) {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    const route = new URL(request.url, 'http://fixture').pathname;
    const active = new Map();
    socket.on('message', raw => {
      const msg = JSON.parse(String(raw));
      if (msg[0] === 'CLOSE') { const entry=active.get(msg[1]); if(entry)entry.closedAt=Date.now(); active.delete(msg[1]); return; }
      if (msg[0] !== 'REQ') { errors.push('read-only history fixture received publication'); socket.close(); return; }
      if (trace.length >= 512) { errors.push('history fixture request bound'); socket.close(); return; }
      const entry = {route,wire:msg[1],filters:msg.slice(2),at:Date.now(),ids:[],frames:0,eoseAt:null};
      trace.push(entry); active.set(msg[1], entry);
      const send = event => { socket.send(JSON.stringify(['EVENT',msg[1],event])); entry.frames++; if(!entry.ids.includes(event.id))entry.ids.push(event.id); };
      for (const filter of msg.slice(2)) {
        if (route !== '/b' || !filter.kinds?.includes(1) || !filter.authors?.includes(events[0].pubkey)) continue;
        if (!head && !filter.until && !filter.since) {
          const limit = Math.min(200, filter.limit ?? 200);
          head = events.slice(0,limit); tail = events[limit];
        }
        if (!head) continue;
        const available = filter.until ? [...head, tail] : head;
        const result = available.filter(e => matches(e,filter)).slice(0,filter.limit ?? 200);
        for (const event of result) { send(event); if(!filter.until)for(let n=0;n<4;n++)send(event); }
      }
      const finish = () => { timers.delete(timer); if(socket.readyState===1 && active.get(msg[1])===entry){socket.send(JSON.stringify(['EOSE',msg[1]]));entry.eoseAt=Date.now();} };
      const timer=setTimeout(finish,route==='/b'?1800:0);timers.add(timer);
    });
  }
  return {route, errors, get head(){return head;},get tail(){return tail;},close(){for(const timer of timers)clearTimeout(timer);timers.clear();for(const socket of sockets)socket.terminate();}};
}
