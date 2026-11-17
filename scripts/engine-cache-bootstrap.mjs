// Reproduce an old profile/follow list outside the newest 2000 cached notes.
// Real release artifacts, signed loopback fixtures, fresh data; never public relays.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { loadavg } from 'node:os';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { cacheBoot } from './engine-cache-boot.mjs';
import { cacheClient } from './engine-cache-client.mjs';
import { cacheStorage } from './engine-cache-storage.mjs';
const pkg = process.env.LKJSTR_CACHE_PACKAGE, fixtureBinary = process.env.LKJSTR_CACHE_FIXTURES;
const expectedWasm = process.env.LKJSTR_CACHE_WASM_SHA256, expectedLoader = process.env.LKJSTR_CACHE_LOADER_SHA256;
if (!pkg || !fixtureBinary || !/^[a-f0-9]{64}$/.test(expectedWasm ?? '') || !/^[a-f0-9]{64}$/.test(expectedLoader ?? '')) {
  throw Error('Explicit production package, both hashes and signed fixture helper paths are required');
}
const output = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/cache-bootstrap');
const temp = resolve(process.env.LKJSTR_TEST_TMPDIR ?? 'tmp');
await mkdir(output, { recursive: true }); await mkdir(temp, { recursive: true });
const owned = await mkdtemp(join(temp, 'cache-')); process.env.TMPDIR = owned;
const report = { startedAt: new Date().toISOString(), loadStart: loadavg(), package: resolve(pkg),
  checks: [], cleanup: {}, pageErrors: 0, externalRequests: 0, published: 0, measurements: {} };
const check = (name, ok) => { report.checks.push({ name, ok: !!ok }); console.log((ok ? 'ok ' : 'FAIL ') + name); };
const hash = b => createHash('sha256').update(b).digest('hex');
let signer, server, sockets, browser, context, client;
try {
  const wasm = await readFile(join(pkg, 'lkjstr_engine_bg.wasm')), loader = await readFile(join(pkg, 'lkjstr_engine.js'));
  report.wasmSha256 = hash(wasm); report.loaderSha256 = hash(loader);
  if (report.wasmSha256 !== expectedWasm || report.loaderSha256 !== expectedLoader) throw Error('Frozen cache package identity differs');
  if (WebAssembly.Module.exports(new WebAssembly.Module(wasm)).some(x => x.name.includes('harness'))) throw Error('A production package is required');
  report.fixtureSha256 = hash(await readFile(fixtureBinary));
  signer = spawn(fixtureBinary, [], { stdio: ['pipe', 'pipe', 'pipe'] }); signer.stderr.resume();
  const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
  const line = async () => {
    let timer;
    try { return await Promise.race([lines.next(), new Promise((_, bad) => {
      timer = setTimeout(() => bad(Error('signed fixture helper deadline')), 20_000);
    })]); } finally { clearTimeout(timer); }
  };
  const initial = JSON.parse((await line()).value), pubkey = initial.note.pubkey;
  const sign = async value => { signer.stdin.write(JSON.stringify(value) + '\n'); return JSON.parse((await line()).value); };
  const profile = await sign({ pubkey, kind: 0, created_at: 1700000001, tags: [],
    content: JSON.stringify({ name: 'cache-fixture', picture: 'https://cache-fixture.invalid/picture.png' }) });
  const note = await sign({ pubkey, kind: 1, created_at: Math.floor(Date.now()/1000), tags: [], content: 'cache bootstrap fixture' });
  const filler = await sign({ fixtureRows: 2100 });
  const follows = initial.events.find(e => e.kind === 3), relay = fakeRelay();
  const relays = new Map([['/relay', relay]]);
  for (const event of [profile, follows, note]) relay.add(event);
  const assets = new Map([['/current/lkjstr_engine.js', loader], ['/current/lkjstr_engine_bg.wasm', wasm]]);
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://owned').pathname;
    if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Owned cache fixture</title>');
    if (path === '/current/worker.js') return res.writeHead(200, { 'content-type': 'text/javascript' }).end(cacheBoot());
    const asset = assets.get(path);
    if (!asset) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }).end(asset);
  });
  sockets = new bundle.wsServer({ server });
  sockets.on('connection', (socket, request) => (relays.get(new URL(request.url, 'http://owned').pathname) ?? relay).route({ send: text => socket.send(text),
    onMessage: fn => socket.on('message', raw => { const value = JSON.parse(String(raw)); if (value[0] === 'EVENT') report.published++; fn(raw); }),
    onClose: fn => socket.on('close', fn) }));
  await new Promise((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.LKJSTR_CHROME ?? process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-background-networking'] });
  context = await browser.newContext();
  await context.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); report.externalRequests++; return route.abort(); });
  context.on('page', page => page.on('pageerror', () => report.pageErrors++));
  client = await cacheClient(context, origin, pubkey, note.id);
  await client.call('boot', 'first', false);
  report.measurements.first = await client.call('observe', 'first', 10_000);
  check('first real Worker receives the signed Home note with its profile', report.measurements.first.hasNote && report.measurements.first.hasName);
  report.saved = await client.call('waitSaved', [note.id, profile.id, follows.id]);
  check('initial signed events commit before reload', report.saved.saved);
  await client.call('stop', 'first');
  await client.call('seed', filler);
  await client.call('boot', 'reopen', true);
  report.measurements.reopen = await client.call('observe', 'reopen', 2500);
  const warm = report.measurements.reopen;
  check('offline Home retains the old follow list and note', warm.hasNote);
  check('offline Home retains the old author name and picture', warm.hasName && warm.hasPicture);
  check('a previously held Home row is projected within 100 ms of opening', warm.firstNameMs !== null && warm.firstNameMs < 100);
  check('new event writes include verification receipts and metadata checkpoint', report.saved.receipts && report.saved.checkpoint);
  await client.call('stop', 'reopen');
  await client.call('corrupt', note.id);
  await client.call('boot', 'corrupt', true);
  report.measurements.corrupt = await client.call('observe', 'corrupt', 500);
  check('changed stored bytes never paint with an old receipt', !report.measurements.corrupt.hasNote);
  check('Worker contexts remain error free', Object.values(report.measurements).every(x => x.workerErrors === 0));
  await client.close(); client = null;
  report.storage = await cacheStorage({ browser, origin, sign, pubkey, note, follows, relays, check, report,
    supported: report.saved.receipts && report.saved.checkpoint });
} catch (error) { report.failure = String(error).slice(0, 1000); }
finally {
  for (const [name, action] of [
    ['workers', () => client?.close()], ['context', () => context?.close()], ['browser', () => browser?.close()],
    ['sockets', async () => { for (const socket of sockets?.clients ?? []) socket.terminate(); sockets?.close(); }],
    ['server', async () => { server?.closeAllConnections(); if (server?.listening) await new Promise(ok => server.close(ok)); }],
    ['signer', async () => { if (signer && signer.exitCode === null) { signer.stdin.end(); await Promise.race([new Promise(ok => signer.once('exit', ok)), new Promise(ok => setTimeout(ok, 1000))]); if (signer.exitCode === null) { signer.kill('SIGKILL'); await new Promise(ok => signer.once('exit', ok)); } } }],
  ]) { try { await action(); report.cleanup[name] = true; } catch { report.cleanup[name] = false; } }
  try { await rm(owned, { recursive: true }); report.cleanup.tempRemoved = true; } catch { report.cleanup.tempRemoved = false; }
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg();
  report.ok = !report.failure && report.pageErrors === 0 && report.externalRequests === 0 && report.published === 0 &&
    report.checks.length === 11 && report.checks.every(x => x.ok) && Object.values(report.cleanup).every(Boolean);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, ok: report.ok, checks: report.checks.length }));
  if (!report.ok) process.exitCode = 1;
}
