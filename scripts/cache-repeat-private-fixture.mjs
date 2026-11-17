// A loopback-only encrypted-message fixture. No upstream relay or external HTTP destination.
import { createServer, request as httpRequest } from 'node:http';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { startStatic, productionPolicy } from './race-server.mjs';
export function privatePolicy(relayUrl) {
  if (!/^ws:\/\/127\.0\.0\.1:\d+\/relay$/.test(relayUrl)) throw Error('Owned loopback relay required');
  return productionPolicy.csp.replace(/connect-src[^;]*/, "connect-src 'self' " + relayUrl)
    .replace(/img-src[^;]*/, "img-src 'self' data: blob:")
    .replace(/media-src[^;]*/, "media-src 'self' data: blob:")
    .replace(/font-src[^;]*/, "font-src 'self' data:");
}
export async function privateFixture(directory) {
  const upstream = await startStatic(directory), fake = fakeRelay({ maxEvents: 256 });
  const connections = new Set(), counts = { clientSentBytes: 0, clientReceivedBytes: 0, events: 0, publications: 0 };
  let base, relayUrl, csp;
  const server = createServer((request, response) => {
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) return void response.writeHead(404).end();
    let target;
    try { target = new URL(request.url, upstream.base); } catch { return void response.writeHead(404).end(); }
    if (target.origin !== new URL(upstream.base).origin) return void response.writeHead(404).end();
    const transfer = httpRequest(target, { method: request.method, headers: request.headers }, source => {
      response.writeHead(source.statusCode ?? 502, { ...source.headers, 'content-security-policy': csp });
      source.pipe(response);
    });
    transfer.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    response.on('close', () => transfer.destroy()); request.pipe(transfer);
  });
  server.on('connection', socket => { connections.add(socket); socket.on('close', () => connections.delete(socket)); });
  const sockets = new bundle.wsServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/relay') return socket.destroy();
    sockets.handleUpgrade(request, socket, head, client => sockets.emit('connection', client));
  });
  sockets.on('connection', socket => {
    fake.route({
      send: text => {
        counts.clientReceivedBytes += Buffer.byteLength(text);
        if (/^\s*\[\s*"EVENT"\s*,/.test(text)) counts.events++;
        socket.send(text);
      },
      onMessage: fn => socket.on('message', raw => {
        counts.clientSentBytes += Buffer.byteLength(raw);
        try { if (JSON.parse(String(raw))[0] === 'EVENT') counts.publications++; }
        catch { socket.close(1003, 'Malformed fixture frame'); return; }
        fn(raw);
      }),
      onClose: fn => socket.on('close', fn),
    });
  });
  const close = async () => {
    for (const socket of sockets.clients) socket.terminate();
    await new Promise(done => sockets.close(done));
    for (const socket of connections) socket.destroy();
    if (server.listening) await new Promise(done => server.close(done));
    await upstream.close();
  };
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    base = 'http://127.0.0.1:' + server.address().port;
    relayUrl = base.replace('http:', 'ws:') + '/relay'; csp = privatePolicy(relayUrl);
    return { base, relayUrl, fake, csp, close, snapshot: () => ({ ...counts }),
      silence() { fake.setReading(false); },
      resume() { fake.setReading(true); for (const socket of sockets.clients) socket.close(1001, 'Fixture reconnect'); } };
  } catch (error) { await close(); throw error; }
}
