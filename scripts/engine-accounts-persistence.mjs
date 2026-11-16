// Actual two-Worker account writes. Only fresh fixture keys; no secret-bearing reports.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { accountsBoot } from './engine-accounts-boot.mjs';
import { accountsClient } from './engine-accounts-client.mjs';
const pkg = process.env.LKJSTR_ACCOUNT_PACKAGE;
const expectedWasm = process.env.LKJSTR_ACCOUNT_WASM_SHA256;
const expectedLoader = process.env.LKJSTR_ACCOUNT_LOADER_SHA256;
if (!pkg || !/^[a-f0-9]{64}$/.test(expectedWasm ?? '') || !/^[a-f0-9]{64}$/.test(expectedLoader ?? '')) {
  throw Error('Explicit frozen account package and both content hashes are required');
}
const output = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/account-persistence-proof');
const temporary = resolve(process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp'));
await mkdir(output, { recursive: true }); await mkdir(temporary, { recursive: true });
const owned = await mkdtemp(join(temporary, 'a-')); process.env.TMPDIR = owned;
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { startedAt: new Date().toISOString(), loadStart: loadavg(), package: resolve(pkg),
  checks: [], cases: [], cleanup: {}, pageErrors: 0, externalRequests: 0, forbiddenSockets: 0 };
const check = (name, ok) => { report.checks.push({ name, ok: !!ok }); console.log((ok ? 'ok ' : 'FAIL ') + name); };
let server, browserServer, browser, context, client, stage = 'asset setup';
async function processIdentity(pid) {
  try { const stat = await readFile('/proc/' + pid + '/stat', 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19]; }
  catch (error) { if (error.code === 'ENOENT') return null; throw Error('owned process observation failed'); }
}
try {
  report.package = await realpath(pkg);
  report.temporary = { path: owned, socketPathBytes: Buffer.byteLength(join(owned, 'org.chromium.Chromium.XXXXXX', 'SingletonSocket')) };
  if (report.temporary.socketPathBytes >= 108) throw Error('owned browser socket path exceeds Linux limit');
  const assets = new Map();
  for (const name of ['lkjstr_engine.js', 'lkjstr_engine_bg.wasm']) assets.set('/current/' + name, await readFile(join(pkg, name)));
  report.wasmSha256 = hash(assets.get('/current/lkjstr_engine_bg.wasm'));
  report.loaderSha256 = hash(assets.get('/current/lkjstr_engine.js'));
  if (report.wasmSha256 !== expectedWasm || report.loaderSha256 !== expectedLoader) throw Error('frozen account package differs');
  report.fixtureSources = Object.fromEntries(await Promise.all(['engine-accounts-persistence.mjs', 'engine-accounts-boot.mjs', 'engine-accounts-client.mjs'].map(async name =>
    [name, hash(await readFile(new URL(name, import.meta.url)))])));
  const boot = accountsBoot(); report.bootstrapSha256 = hash(boot);
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://owned').pathname;
    if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Owned account persistence fixture</title>');
    if (path === '/current/worker.js') return res.writeHead(200, { 'content-type': 'text/javascript' }).end(boot);
    const asset = assets.get(path);
    if (!asset) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }).end(asset);
  });
  server.on('upgrade', (_req, socket) => { report.forbiddenSockets++; socket.destroy(); });
  await new Promise((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  stage = 'browser startup';
  const cache = process.env.HOME + '/.cache/ms-playwright';
  const binary = process.env.LKJSTR_CHROME ?? join(cache, (await readdir(cache)).filter(x => x.startsWith('chromium-')).sort().pop(), 'chrome-linux64/chrome');
  browserServer = await chromium.launchServer({ executablePath: binary, args: ['--no-sandbox'] });
  report.browser = { pid: browserServer.process().pid, start: await processIdentity(browserServer.process().pid) };
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const kind of ['new-account', 'protected-account']) {
    stage = kind + ' setup';
    context = await browser.newContext();
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      report.externalRequests++; return route.abort();
    });
    context.on('page', page => page.on('pageerror', () => report.pageErrors++));
    client = await accountsClient(context, origin);
    const entry = { kind, setup: await client.prepare() }; report.cases.push(entry);
    check(kind + ': second Worker loaded the same committed first account', entry.setup.aPresent && entry.setup.aActive && entry.setup.noWorkerError);
    stage = kind + ' second writer';
    entry.before = kind === 'new-account' ? await client.addSecond() : await client.protectFirst();
    check(kind + ': second writer committed its intended durable change', kind === 'new-account' ?
      entry.before.aPresent && entry.before.bPresent : entry.before.aPresent && entry.before.aProtected && !entry.before.aPlaintext);
    stage = kind + ' stale writer';
    entry.after = await client.staleSeen();
    check(kind + ': stale snapshot does not acknowledge a whole-record replacement', !entry.after.acknowledged);
    check(kind + ': stale snapshot preserves the newer durable key state', kind === 'new-account' ?
      entry.after.aPresent && entry.after.bPresent : entry.after.aPresent && entry.after.aProtected && !entry.after.aPlaintext);
    stage = kind + ' fresh reload';
    entry.reloaded = await client.reload();
    check(kind + ': a fresh Worker reload preserves the newer key state', entry.reloaded.noWorkerError && (kind === 'new-account' ?
      entry.reloaded.aPresent && entry.reloaded.bPresent : entry.reloaded.aPresent && entry.reloaded.aProtected));
    entry.current = await client.currentSeen();
    check(kind + ': current-snapshot action succeeds without a further key-state change', entry.current.acknowledged &&
      ['aPresent', 'bPresent', 'aProtected', 'bProtected', 'aPlaintext', 'bPlaintext'].every(key => entry.current[key] === entry.after[key]));
    await client.close(); client = undefined; await context.close(); context = undefined;
  }
} catch (error) {
  // Startup precedes all accounts; later errors may retain secret RPC context.
  if (stage === 'browser startup') report.startupError = { name: error.name, message: String(error.message).slice(0, 3000) };
  report.failure = stage; console.error('account persistence fixture failed during ' + stage);
} finally {
  for (const [name, close] of [
    ['workers', () => client?.close()], ['context', () => context?.close()], ['browserConnection', () => browser?.close()],
    ['browserServer', () => browserServer?.close()],
    ['server', async () => { server?.closeAllConnections(); if (server?.listening) await new Promise(ok => server.close(ok)); }],
  ]) {
    try { await close(); report.cleanup[name] = true; } catch { report.cleanup[name] = false; }
  }
  if (report.browser) report.cleanup.browserReaped = await processIdentity(report.browser.pid) !== report.browser.start;
  try { await rm(owned, { recursive: true }); report.cleanup.tempRemoved = true; } catch { report.cleanup.tempRemoved = false; }
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg(); report.durationMs = Date.now() - Date.parse(report.startedAt);
  report.ok = !report.failure && report.pageErrors === 0 && report.externalRequests === 0 && report.forbiddenSockets === 0 &&
    Object.values(report.cleanup).every(Boolean) && report.checks.length === 12 && report.checks.every(item => item.ok);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, ok: report.ok, checks: report.checks.length, durationMs: report.durationMs }));
  if (!report.ok) process.exitCode = 1;
}
