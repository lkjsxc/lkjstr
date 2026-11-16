// Finite real Worker zap proof. Public sockets/HTTP are blocked; fixture HTTPS is intercepted.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { loadavg } from 'node:os';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { fakeBunker } from './browser-bunker.mjs';
import { fixtureProcess } from './engine-fixture-process.mjs';
import { validateReplies, protocolVersion } from './engine-contract.mjs';
import { workerBoot } from './engine-harness-boot.mjs';
import { zaps } from './engine-zaps.mjs';
const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/zap-pkg-frozen');
const out = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/zap-harness');
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const run = { startedAt: new Date().toISOString(), loadStart: loadavg(), package: pkg,
  wasmSha256: await hash(join(pkg, 'lkjstr_engine_bg.wasm')),
  bindingSha256: await hash(join(pkg, 'lkjstr_engine.js')),
  contractSha256: await hash('web/src/engine/protocol.ts'), protocolVersion, virtualDeadline: false };
await mkdir(out, { recursive: true });
const checks = [], errors = [], fake = fakeRelay(), sockets = new Set();
let origin, browser, page, signer, bunker, lines, extensionPubkey, serial = 0;
const identified = new Set();
const check = (name, ok) => {
  checks.push({ name, ok: Boolean(ok) });
  console.log((ok ? 'ok ' : 'FAIL ') + name);
  if (!ok) throw new Error(name);
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' })
    .end('<!doctype html><title>Zap engine fixture</title>');
  if (path === '/worker.js') return res.writeHead(200, { 'content-type': 'text/javascript' })
    .end(workerBoot('/archive-worker.js', origin));
  const file = join(pkg, path);
  if (!file.startsWith(pkg + '/')) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': extname(file) === '.wasm' ? 'application/wasm' : 'text/javascript' }).end(body);
  } catch { res.writeHead(404).end(); }
});
server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
const wsServer = new bundle.wsServer({ server });
wsServer.on('connection', (ws, req) => {
  if (req.url === '/bunker') return bunker.route(ws);
  fake.route({ send: text => ws.readyState === 1 && ws.send(text),
    onMessage: fn => ws.on('message', fn), onClose: fn => ws.on('close', fn) });
});
async function until(test, ms = 25_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const all = await page.evaluate(() => window.messages);
    for (const request of all.filter(m => m.t === 'getPublicKey' && !identified.has(m.req))) {
      identified.add(request.req);
      await send({ t: 'publicKey', req: request.req, pubkey: extensionPubkey });
    }
    if (all.some(m => m.t === 'worker-error')) throw new Error('zap Worker startup failure');
    if (test(all)) return all;
    await page.waitForTimeout(25);
  }
  throw new Error('zap runner predicate timeout');
}
const send = msg => page.evaluate(msg => window.worker.postMessage(msg), msg);
const act = async action => {
  const req = 'zap-runner-' + (++serial);
  await send({ t: 'act', req, action });
  const all = await until(all => all.some(m => m.t === 'result' && m.req === req));
  return all.find(m => m.t === 'result' && m.req === req);
};
try {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  origin = 'http://127.0.0.1:' + server.address().port;
  bunker = await fakeBunker();
  signer = fixtureProcess('engine-fixtures', { stdio: ['pipe', 'pipe', 'pipe'] });
  signer.stderr.resume();
  lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
  const fixture = JSON.parse((await lines.next()).value), events = [];
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (value.id && value.sig && value.kind !== undefined) events.push(value);
    else Object.values(value).forEach(walk);
  };
  walk(fixture);
  const note = events.find(e => e.kind === 1);
  if (!note) throw new Error('fixture note missing');
  extensionPubkey = note.pubkey;
  for (const event of events) fake.add(event);
  const base = process.env.HOME + '/.cache/ms-playwright';
  const binary = process.env.LKJSTR_CHROME ?? join(base,
    (await readdir(base)).filter(s => s.startsWith('chromium-')).sort().at(-1), 'chrome-linux64/chrome');
  browser = await chromium.launch({ executablePath: binary, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(origin);
  await page.evaluate(() => {
    window.messages = [];
    window.worker = new Worker('/worker.js', { type: 'module' });
    window.worker.onmessage = event => window.messages.push(event.data);
    window.worker.onerror = event => window.messages.push({ t: 'worker-error', message: event.message });
  });
  const ready = await until(all => all.some(m => m.t === 'ready'));
  check('real Worker reports the frozen additive protocol', ready.find(m => m.t === 'ready').version === protocolVersion);
  await send({ t: 'test.relays', relays: [origin.replace('http:', 'ws:')] });
  check('fresh fixture extension account opens', (await act({ a: 'account.add', how: 'extension', key: note.pubkey })).ok);
  await zaps({ page, send, check, note, signer, lines, origin, bunker, fake, act,
    kinds: new Set(), signerDeadline: true });
  const messages = await page.evaluate(() => window.messages);
  validateReplies(messages);
  check('all zap Worker replies satisfy the current TypeScript contract', true);
  check('no page errors', errors.length === 0);
  check('no zap request or receipt reached the loopback relay as a publication',
    fake.published.every(e => e.kind !== 9734 && e.kind !== 9735));
} catch (error) {
  run.failure = String(error);
  if (page) run.tail = await page.evaluate(() => window.messages.slice(-30).map(m => ({
    t: m.t, req: m.req, ok: m.ok, error: m.error?.code, quote: m.quote?.phase, receipt: m.page?.phase,
    state: m.state?.phase, rows: m.rows?.length, actionReq: m.actionReq,
  }))).catch(() => []);
} finally {
  await page?.evaluate(() => { window.worker?.postMessage({ t: 'detach' }); window.worker?.terminate(); }).catch(() => {});
  await browser?.close().catch(error => { errors.push('browser cleanup: ' + error); });
  await bunker?.close().catch(error => { errors.push('bunker cleanup: ' + error); });
  if (signer?.exitCode === null && signer?.signalCode === null) {
    const exited = once(signer, 'exit'); signer.stdin.end();
    const kill = setTimeout(() => signer.kill('SIGKILL'), 2000);
    await exited.finally(() => clearTimeout(kill));
  }
  for (const socket of sockets) socket.destroy();
  wsServer.close();
  if (server.listening) await new Promise(ok => server.close(ok));
  run.finishedAt = new Date().toISOString(); run.loadEnd = loadavg();
  await writeFile(join(out, 'report.json'), JSON.stringify({ run, checks, errors }, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: checks.filter(c => c.ok).length, failed: checks.filter(c => !c.ok).length,
  error: run.failure, errors, report: join(out, 'report.json') }));
if (run.failure || errors.length || checks.some(c => !c.ok)) process.exitCode = 1;
