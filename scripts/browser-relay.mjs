// Bounded fake relay for the smoke. Never connects to an upstream WebSocket.
import { spawn } from 'node:child_process';

export async function fixtures(root, published = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('cargo', ['run', '-q', '-p', 'lkjstr-protocol', '--example', 'browser-fixtures'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS ?? '4' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    // Do not print child output on failure; stdin contains signed public events only.
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`protocol fixture helper exited ${code}`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('invalid fixture output')); }
    });
    child.stdin.end(JSON.stringify({ root, published }));
  });
}

const matches = (e, f) =>
  (!f.ids || f.ids.includes(e.id)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.since || e.created_at >= f.since) &&
  (!f.until || e.created_at <= f.until) &&
  (!f.search || e.content.toLowerCase().includes(f.search.toLowerCase())) &&
  Object.entries(f).filter(([k]) => k.startsWith('#'))
    .every(([k, v]) => e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));

export function fakeRelay(options = {}) {
  const stored = [], published = [], clients = new Map(), searches = [], authEvents = [];
  let remote;
  let authRetries = 0, opened = 0;
  let reading = true;
  let accepts = () => true;
  function send(ws, sub, event) { ws.send(JSON.stringify(['EVENT', sub, event])); }
  function add(event) {
    if (stored.length >= (options.maxEvents ?? 1000) || stored.some((e) => e.id === event.id)) return;
    stored.push(event);
    for (const [ws, subs] of clients) {
      for (const [sub, filters] of subs) if (filters.some((f) => matches(event, f))) send(ws, sub, event);
    }
  }
  function route(ws) {
    const subs = new Map();
    const authClosed = new Set();
    let authenticated = !options.requireAuth;
    opened += 1;
    clients.set(ws, subs);
    ws.onClose(() => clients.delete(ws));
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      if (msg[0] === 'AUTH') {
        if(authEvents.length<1000)authEvents.push(msg[1]);
        authenticated = true;
        ws.send(JSON.stringify(['OK', msg[1].id, true, 'authenticated']));
      } else if (msg[0] === 'EVENT') {
        if(!authenticated){ws.send(JSON.stringify(['OK',msg[1].id,false,'auth-required: authenticate first']));ws.send(JSON.stringify(['AUTH','local smoke challenge']));return;}
        if (published.length < 1000 && !published.some((e) => e.id === msg[1].id)) published.push(msg[1]);
        if (!accepts(msg[1])) {
          ws.send(JSON.stringify(['OK', msg[1].id, false, 'blocked: local fixture recipient']));
          return;
        }
        add(msg[1]);
        ws.send(JSON.stringify(['OK', msg[1].id, true, '']));
      } else if (msg[0] === 'REQ') {
        const [, sub, ...filters] = msg;
        if (subs.size >= 100) throw new Error('fake relay subscription bound exceeded');
        if (!authenticated) {
          if (authClosed.size < 100) authClosed.add(sub);
          ws.send(JSON.stringify(['CLOSED', sub, 'auth-required: authenticate first']));
          ws.send(JSON.stringify(['AUTH', 'local smoke challenge']));
          return;
        }
        if (authClosed.size) { authRetries += 1; authClosed.clear(); }
        subs.set(sub, filters);
        if (options.request?.(ws, sub, filters)) return;
        for (const f of filters) if (f.search && searches.length < 1000) searches.push(f.search);
        if (filters.some((f) => f.search === 'refused-search-query')) {
          ws.send(JSON.stringify(['CLOSED', sub, 'error: local smoke refusal']));
          subs.delete(sub);
          return;
        }
        const events = !reading ? [] : remote && filters.some((f) => f.search) ? [...stored, remote] : stored;
        for (const e of events) if (filters.some((f) => matches(e, f))) send(ws, sub, e);
        ws.send(JSON.stringify(['EOSE', sub]));
      } else if (msg[0] === 'CLOSE') subs.delete(msg[1]);
    });
  }
  return { setAcceptance: (value) => { accepts = value; }, route, stored, published, searches, authEvents, add, activeFilters:()=>[...clients.values()].flatMap(subs=>[...subs.values()].flat()), connections: () => clients.size, opened: () => opened, authRetries: () => authRetries, setReading: (value) => { reading = value; }, setRemote: (event) => { remote = event; } };
}
