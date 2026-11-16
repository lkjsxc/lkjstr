// Real production Worker with a fixture-only trigger for its original 60-second timer callback.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { signerFixtures } from './engine-dm-signer-fixture.mjs';
import { signerClient } from './engine-dm-signer-client.mjs';
import { privateSignCases } from './engine-dm-sign-deadline-cases.mjs';
const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const output = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/dm-sign-deadlines/after');
await mkdir(output, { recursive: true });
process.env.TMPDIR = process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp');
await mkdir(process.env.TMPDIR, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  loadStart: loadavg(),
  package: pkg,
  virtualDeadline: true,
  wasmSha256: createHash('sha256')
    .update(await readFile(join(pkg, 'lkjstr_engine_bg.wasm')))
    .digest('hex'),
  checks: [],
};
function check(name, ok, observed) {
  report.checks.push({ name, ok: !!ok, ...(observed === undefined ? {} : { observed }) });
  console.log((ok ? 'ok ' : 'FAIL ') + name);
}
const boot = `const NativeSocket=self.WebSocket;self.WebSocket=class extends NativeSocket{
constructor(url,protocols){if(new URL(url).origin!==self.location.origin.replace('http:','ws:'))throw Error('fixture blocks public sockets');super(url,protocols);}};
const timers=new Map(),startTimer=self.setTimeout.bind(self),clearTimer=self.clearTimeout.bind(self);
self.setTimeout=(callback,ms,...args)=>{const id=startTimer(()=>{timers.delete(id);callback(...args);},ms);if(ms===60000)timers.set(id,{callback,args,ms});return id;};
self.clearTimeout=id=>{timers.delete(id);clearTimer(id);};
import init,{start} from './lkjstr_engine.js';
const queued=[];self.onmessage=e=>queued.push(e);await init();self.engineHandle=start();const input=self.onmessage;
self.onmessage=e=>{if(e.data.t==='fixture.expire'){const milliseconds=[];for(const [id,timer]of [...timers]){timers.delete(id);clearTimer(id);milliseconds.push(timer.ms);timer.callback(...timer.args);}self.postMessage({t:'fixture.expired',milliseconds});}else input(e);};
for(const event of queued)self.onmessage(event);`;
let browser, server, sockets, fixtures;
const fake = fakeRelay();
try {
  fixtures = await signerFixtures();
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture').pathname;
    if (path === '/')
      return res
        .writeHead(200, { 'content-type': 'text/html' })
        .end('<!doctype html><title>Owned private signing fixture</title>');
    if (path === '/worker.js')
      return res.writeHead(200, { 'content-type': 'text/javascript' }).end(boot);
    if (!['/lkjstr_engine.js', '/lkjstr_engine_bg.wasm'].includes(path))
      return res.writeHead(404).end();
    try {
      res
        .writeHead(200, {
          'content-type': path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
        })
        .end(await readFile(join(pkg, path)));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', done);
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  sockets = new bundle.wsServer({ server });
  sockets.on('connection', (socket, request) => {
    if (request.url === '/bunker') return fixtures.relay(socket);
    fake.route({
      send: (raw) => socket.readyState === 1 && socket.send(raw),
      onMessage: (fn) => socket.on('message', fn),
      onClose: (fn) => socket.on('close', fn),
    });
  });
  browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox'],
  });
  const make = (recipient) => {
    fake.stored.length = 0;
    fake.published.length = 0;
    return signerClient({ browser, origin, fixtures, fake, recipient });
  };
  await privateSignCases({ make, fixtures, fake, check });
  check(
    'owned private signing fixtures had no helper errors',
    fixtures.calls.every((c) => !c.fixtureError),
  );
} catch (error) {
  report.failure = String(error);
  console.error(report.failure);
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    fixtures?.close(),
    (async () => {
      if (sockets) {
        for (const socket of sockets.clients) socket.terminate();
        await new Promise((done) => sockets.close(done));
      }
      if (server?.listening) await new Promise((done) => server.close(done));
    })(),
  ]);
  for (const r of cleanup) if (r.status === 'rejected') report.cleanup = String(r.reason);
  report.finishedAt = new Date().toISOString();
  report.loadEnd = loadavg();
  report.ok = !report.failure && !report.cleanup && report.checks.every((c) => c.ok);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.ok) process.exitCode = 1;
}
