// Finite production-Worker A1/A2 proof. Only fresh owned loopback and synthetic signed events.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, mkdtemp, rm, writeFile, copyFile, lstat } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join, basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { actsFixture } from './engine-acts-fixture.mjs';
import { actsRelay } from './engine-acts-relay.mjs';
import { actsBoot, actsPage, actsLnurl } from './engine-acts-boot.mjs';
import { exerciseActs } from './engine-acts-checks.mjs';
const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const out = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/acts-worker');
await mkdir(out, { recursive: true });
for (const file of ['fixture.json', 'report.json']) {
  try { await lstat(join(out, file)); throw Error('use a fresh acts report directory'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const hash = body => createHash('sha256').update(body).digest('hex');
let loader = { module: '/lkjstr_engine.js', wasm: 'lkjstr_engine_bg.wasm' };
try { loader = JSON.parse(await readFile(join(pkg, 'fixture-loader.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!/^\/[A-Za-z0-9_.-]+\.js$/.test(loader.module) || !/^[A-Za-z0-9_.-]+\.wasm$/.test(loader.wasm))
  throw Error('owned package loader shape');
const report = { startedAt: new Date().toISOString(), loadStart: loadavg(), package: pkg,
  checks: [], errors: [], blockedHttp: [], metadataReads: [], sourceHashes: {} };
const check = (name, ok, observed) => { report.checks.push({ name, ok: Boolean(ok),
  ...(observed === undefined ? {} : { observed }) }); console.log((ok ? 'ok ' : 'FAIL ') + name); };
const error = value => { if (report.errors.length < 20) report.errors.push(String(value).slice(0, 500)); };
const started = performance.now(), deadline = started + 110_000, pause = ms => new Promise(ok => setTimeout(ok, ms));
const temporaryBase = process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp');
const previousTmp = process.env.TMPDIR;
let temporary, browser, context, server, ws, relay, page, data;
const state = () => page.evaluate(() => window.acts);
const send = value => page.evaluate(value => window.actsWorker.postMessage(value), value);
async function until(predicate, timeout = 5000) {
  const end = Math.min(deadline, performance.now() + timeout);
  while (performance.now() < end) {
    const value = await state();
    if (value.errors.length) throw Error(value.errors[0]);
    if (predicate(value)) return true;
    await pause(25);
  }
  if (performance.now() >= deadline) throw Error('owned act proof aggregate deadline');
  return false;
}
try {
  await mkdir(temporaryBase, { recursive: true }); temporary = await mkdtemp(join(temporaryBase, 'ac-')); process.env.TMPDIR = temporary;
  const frozenPackage = join(temporary, 'package'); await mkdir(frozenPackage);
  for (const file of [basename(loader.module), loader.wasm]) await copyFile(join(pkg, file), join(frozenPackage, file));
  report.wasmSha256 = hash(await readFile(join(frozenPackage, loader.wasm)));
  report.bindingSha256 = hash(await readFile(join(frozenPackage, basename(loader.module))));
  for (const name of ['harness', 'fixture', 'data', 'relay', 'boot', 'checks']) {
    const file = 'scripts/engine-acts-' + name + '.mjs'; report.sourceHashes[file] = hash(await readFile(file));
  }
  report.protocolSha256 = hash(await readFile('web/src/engine/protocol.ts'));
  report.injectedBootSha256 = hash(actsBoot(loader.module)); report.injectedPageSha256 = hash(actsPage.toString());
  data = await actsFixture(temporary); relay = actsRelay(data);
  const fixtureBody = JSON.stringify(data, null, 2) + '\n'; report.fixtureSha256 = hash(fixtureBody);
  report.helperSha256 = data.helperSha256; report.fixtureEvents = data.catalog.length;
  await writeFile(join(out, 'fixture.json'), fixtureBody, { flag: 'wx' });
  const boot = actsBoot(loader.module);
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture').pathname;
    if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Owned acts fixture</title>');
    if (path === '/worker.js') return res.writeHead(200, { 'content-type': 'text/javascript' }).end(boot);
    if (path === '/relay') return res.writeHead(200, { 'content-type': 'application/nostr+json' })
      .end(JSON.stringify({ limitation: { max_limit: 200 } }));
    if (![loader.module, '/' + loader.wasm].includes(path)) return res.writeHead(404).end();
    try { res.writeHead(200, { 'content-type': path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' })
      .end(await readFile(join(frozenPackage, basename(path)))); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port; report.origin = origin;
  ws = new bundle.wsServer({ server, path: '/relay', maxPayload: 128 * 1024 }); ws.on('connection', relay.connection);
  const cache = process.env.HOME + '/.cache/ms-playwright';
  const binary = process.env.LKJSTR_CHROME ?? join(cache,
    (await readdir(cache)).filter(name => name.startsWith('chromium-')).sort().at(-1), 'chrome-linux64/chrome');
  browser = await chromium.launch({ executablePath: binary, args: ['--no-sandbox'] });
  context = await browser.newContext({ serviceWorkers: 'block' }); context.setDefaultTimeout(5000);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.href === actsLnurl && request.method() === 'GET') {
      const headers = request.headers();
      if (report.metadataReads.length >= 8) { error('owned metadata read bound'); return route.abort(); }
      report.metadataReads.push({ anonymous: !headers.cookie && !headers.authorization && !headers.referer, at: Date.now() });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ tag: 'payRequest', allowsNostr: true, nostrPubkey: data.provider,
          callback: 'https://zap.fixture.invalid/callback?fixture=1', minSendable: 1000, maxSendable: 1_000_000_000,
          commentAllowed: 128, metadata: JSON.stringify([['text/plain', 'Zap fixture'], ['text/identifier', 'receiver@zap.fixture.invalid']]) }) });
    }
    if (report.blockedHttp.length < 20) report.blockedHttp.push({ origin: url.origin, method: request.method() });
    return route.abort();
  });
  page = await context.newPage(); page.on('pageerror', error); await page.goto(origin);
  await page.evaluate(actsPage);
  if (!await until(value => Boolean(value.ready), 15_000)) throw Error('act Worker readiness deadline');
  report.ready = (await state()).ready;
  await send({ t: 'configure', config: { language: 'en', heuristics: false, prefetch: false } });
  await send({ t: 'relays', relays: [{ url: origin.replace('http:', 'ws:') + '/relay', read: true, write: false, search: false }] });
  report.projections = await exerciseActs({ data, relay, send, state, until, check });
  report.final = await state();
  check('Worker sends no signer request or blocked socket/publication attempt',
    report.final.signerRequests === 0 && report.final.guards.length === 0 && relay.forbidden === 0);
  check('only locally fulfilled anonymous LNURL metadata is requested outside loopback',
    report.blockedHttp.length === 0 && report.metadataReads.length > 0 && report.metadataReads.every(value => value.anonymous));
  check('owned relay fixture stays within its request and evidence bounds', relay.errors.length === 0);
  await page.evaluate(() => window.actsWorker.terminate());
} catch (cause) { report.failure = String(cause).slice(0, 500); console.error(report.failure); }
finally {
  if (page && !report.final) try { report.final = await state(); } catch {}
  await context?.close().catch(error); await browser?.close().catch(error); relay?.close();
  if (ws) { for (const socket of ws.clients) socket.terminate(); await new Promise(ok => ws.close(ok)); }
  if (server?.listening) { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
  report.requests = relay?.requests ?? []; report.fixtureErrors = relay?.errors ?? [];
  if (temporary) await rm(temporary, { recursive: true, force: true }).catch(error);
  if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp;
  report.cleanup = { browser: !browser?.isConnected(), server: !server?.listening, fixtureSockets: relay?.sockets ?? 0,
    temporaryRemoved: Boolean(temporary) && !report.errors.some(value => value.includes(temporary)) };
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg(); report.durationMs = performance.now() - started;
  report.ok = !report.failure && !report.errors.length && !report.fixtureErrors.length
    && !report.final?.errors?.length && report.checks.length >= 30 && report.checks.every(value => value.ok);
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, ok: report.ok, checks: report.checks.length, failure: report.failure, durationMs: report.durationMs }));
  if (!report.ok) process.exitCode = 1;
}
