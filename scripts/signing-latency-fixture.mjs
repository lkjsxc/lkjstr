// Serve immutable release assets and disposable signed traffic on a fresh loopback port.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeBunker } from './browser-bunker.mjs';
import { fixtureProcess } from './engine-fixture-process.mjs';

export const clock = () => performance.timeOrigin + performance.now();

export async function fixture(dist, output, useBunker, ackDelay) {
  const signer = fixtureProcess('engine-fixtures', { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
  const { note, events: metadata } = JSON.parse((await lines.next()).value);
  let signChain = Promise.resolve();
  const sign = (event) => {
    const result = signChain.then(async () => {
      signer.stdin.write(JSON.stringify(event) + '\n');
      return JSON.parse((await lines.next()).value);
    });
    signChain = result.then(() => {});
    return result;
  };
  const feedPath = resolve(output, 'public-feed.json');
  let events;
  try {
    events = JSON.parse(await readFile(feedPath));
  } catch {
    events = await sign({ fixtureRows: 6000 });
    await writeFile(feedPath, JSON.stringify(events));
  }
  const bunker = useBunker ? await fakeBunker() : undefined;
  const history = [note, ...metadata];
  const subs = new Map();
  const deliveries = new Map();
  const acks = new Set();
  let relayOrigin, sent = 0;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://local').pathname;
    const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path));
    try {
      if (!file.startsWith(dist + '/')) return void res.writeHead(404).end();
      const bytes = await readFile(file);
      res.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Content-Security-Policy': `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${relayOrigin}; img-src 'self' data: blob:; frame-ancestors 'none'`,
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  const sockets = new bundle.wsServer({ server });
  function send(socket, message) {
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
  }
  sockets.on('connection', (socket, req) => {
    if (req.url === '/bunker' && bunker) return bunker.route(socket);
    if (req.url !== '/fixture') return socket.close();
    const live = new Map();
    subs.set(socket, live);
    socket.on('close', () => subs.delete(socket));
    socket.on('message', (raw) => {
      const [type, value, ...filters] = JSON.parse(raw);
      if (type === 'REQ') {
        live.set(value, filters);
        for (const event of history.filter((e) => filters.some((f) => matches(e, f))))
          send(socket, ['EVENT', value, event]);
        send(socket, ['EOSE', value]);
      } else if (type === 'CLOSE') {
        live.delete(value);
      } else if (type === 'EVENT' && !deliveries.has(value.id)) {
        const delivery = { frame: clock() };
        deliveries.set(value.id, delivery);
        const timer = setTimeout(() => {
          acks.delete(timer);
          delivery.ack = clock();
          send(socket, ['OK', value.id, true, '']);
        }, ackDelay);
        acks.add(timer);
      }
    });
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  const origin = 'http://127.0.0.1:' + server.address().port;
  relayOrigin = origin.replace(/^http/, 'ws');
  const relay = relayOrigin + '/fixture';
  if (bunker) {
    // CSP admits both endpoints on the same local fixture server.
    history.push(await bunker.fixture(10002, [['r', relay]], Math.floor(Date.now() / 1000)));
  }
  history.push(await sign({
    pubkey: note.pubkey, created_at: Math.floor(Date.now() / 1000),
    kind: 10002, tags: [['r', relay]], content: '',
  }));
  return {
    origin, relay, bunker: bunker && `bunker://${bunker.pubkey}?relay=${encodeURIComponent(relayOrigin + '/bunker')}`,
    pubkey: note.pubkey, events, sign, deliveries, sent: () => sent,
    push(batch) {
      for (const event of batch) {
        for (const [socket, live] of subs) for (const [id, filters] of live)
          if (filters.some((f) => matches(event, f))) {
            send(socket, ['EVENT', id, event]);
            sent++;
          }
      }
    },
    async close() {
      for (const timer of acks) clearTimeout(timer);
      for (const socket of sockets.clients) socket.terminate();
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
      signer.stdin.end();
      await bunker?.close();
    },
  };
}

function matches(event, filter) {
  return (!filter.kinds || filter.kinds.includes(event.kind))
    && (!filter.authors || filter.authors.includes(event.pubkey)) && (!filter.ids || filter.ids.includes(event.id))
    && (!filter.since || event.created_at >= filter.since) && (!filter.until || event.created_at <= filter.until)
    && Object.entries(filter).filter(([key]) => key.startsWith('#')).every(([key, values]) =>
      event.tags.some(([name, value]) => name === key.slice(1) && values.includes(value)));
}
