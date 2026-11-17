// Finite actual-IDB schema, boot, cancellation and account-removal guards.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { accountsGuardsBoot } from './engine-accounts-guards-boot.mjs';
import { accountsGuardsClient } from './engine-accounts-guards-client.mjs';
const packages = [
  ['current', 'LKJSTR_ACCOUNT_PACKAGE', 'LKJSTR_ACCOUNT_WASM_SHA256', 'LKJSTR_ACCOUNT_LOADER_SHA256'],
  ['legacy', 'LKJSTR_ACCOUNT_LEGACY_PACKAGE', 'LKJSTR_ACCOUNT_LEGACY_WASM_SHA256', 'LKJSTR_ACCOUNT_LEGACY_LOADER_SHA256'],
];
for (const [, path, wasm, loader] of packages) {
  if (!process.env[path] || !/^[a-f0-9]{64}$/.test(process.env[wasm] ?? '') || !/^[a-f0-9]{64}$/.test(process.env[loader] ?? '')) {
    throw Error('Explicit frozen current and legacy production paths and both hashes are required');
  }
}
const cases = [
  ['genuine-absence', 4], ['v1-undefined-account', 8], ['v1-undefined-revision', 8], ['v1-malformed-account', 8],
  ['v2-undefined-account', 8], ['v2-undefined-revision', 8], ['v2-malformed-account', 8], ['v2-read-error', 9],
  ['shared-failure', 12], ['blocked-timeout', 12], ['stopped-blocked', 7], ['stopped-success', 4],
  ['timeout-success', 9], ['removal-conflict', 7], ['removal-abort', 5],
];
const output = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/account-guards-proof');
const temporary = resolve(process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp', 'ag'));
await mkdir(output, { recursive: true }); await mkdir(temporary, { recursive: true });
const owned = await mkdtemp(join(temporary, 'a-')); process.env.TMPDIR = owned;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { startedAt: new Date().toISOString(), loadStart: loadavg(), packages: {}, cases: [], checks: [], cleanup: {}, pageErrors: 0, externalRequests: 0, forbiddenSockets: 0 };
let server, browserServer, browser, context, client, stage = 'asset setup';
async function processIdentity(pid) {
  try { const stat = await readFile('/proc/' + pid + '/stat', 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19]; }
  catch (error) { if (error.code === 'ENOENT') return null; throw Error('owned process observation failed'); }
}
try {
  report.temporary = { path: owned, socketPathBytes: Buffer.byteLength(join(owned, 'org.chromium.Chromium.XXXXXX', 'SingletonSocket')) };
  if (report.temporary.socketPathBytes >= 108) throw Error('owned browser socket path exceeds Linux limit');
  const assets = new Map();
  for (const [graph, path, wasm, loader] of packages) {
    const directory = await realpath(process.env[path]);
    const binary = await readFile(join(directory, 'lkjstr_engine_bg.wasm')), module = await readFile(join(directory, 'lkjstr_engine.js'));
    const wasmSha256 = hash(binary), loaderSha256 = hash(module);
    if (wasmSha256 !== process.env[wasm] || loaderSha256 !== process.env[loader]) throw Error('frozen guard package differs');
    report.packages[graph] = { path: directory, wasmSha256, loaderSha256 };
    assets.set('/' + graph + '/lkjstr_engine_bg.wasm', binary); assets.set('/' + graph + '/lkjstr_engine.js', module);
  }
  report.fixtureSources = Object.fromEntries(await Promise.all(['engine-accounts-guards.mjs', 'engine-accounts-guards-boot.mjs', 'engine-accounts-guards-client.mjs'].map(async name =>
    [name, hash(await readFile(new URL(name, import.meta.url)))])));
  const boot = accountsGuardsBoot(); report.bootstrapSha256 = hash(boot);
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://owned').pathname;
    if (path === '/') return res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }).end('<!doctype html><title>Owned account storage guard fixture</title>');
    if (path === '/current/guard-worker.js' || path === '/legacy/guard-worker.js') return res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }).end(boot);
    const asset = assets.get(path); if (!asset) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', 'cache-control': 'no-store' }).end(asset);
  });
  server.on('upgrade', (_req, socket) => { report.forbiddenSockets++; socket.destroy(); });
  await new Promise((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  stage = 'browser startup';
  const binary = process.env.LKJSTR_CHROME ?? join(process.env.HOME, '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
  browserServer = await chromium.launchServer({ executablePath: binary, args: ['--no-sandbox'] });
  report.browser = { pid: browserServer.process().pid, start: await processIdentity(browserServer.process().pid) };
  await writeFile(join(output, 'owned-browser.json'), JSON.stringify({ ...report.browser, temporary: owned }) + '\n');
  browser = await chromium.connect(browserServer.wsEndpoint());
  for (const [kind, expected] of cases) {
    stage = kind; context = await browser.newContext();
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      report.externalRequests++; return route.abort();
    });
    context.on('page', page => page.on('pageerror', () => report.pageErrors++));
    client = await accountsGuardsClient(context, origin);
    let deadline;
    const checks = await Promise.race([client.run(kind), new Promise((_, bad) => { deadline = setTimeout(() => bad(Error('owned case deadline')), 60_000); })]).finally(() => clearTimeout(deadline));
    if (checks.length !== expected || checks.some(c => typeof c.name !== 'string' || typeof c.ok !== 'boolean' || Object.keys(c).length !== 2)) throw Error('owned guard assertion shape differs');
    for (const check of checks) { report.checks.push(check); console.log((check.ok ? 'ok ' : 'FAIL ') + check.name); }
    report.cases.push({ kind, checks: checks.length, ok: checks.every(c => c.ok) });
    await client.close(); client = undefined; await context.close(); context = undefined;
  }
} catch (error) {
  if (stage === 'browser startup') report.startupError = { name: error.name, message: String(error.message).slice(0, 3000) };
  report.failure = stage; console.error('account guard fixture failed during ' + stage);
} finally {
  for (const [name, close] of [
    ['workers', () => client?.close()], ['context', () => context?.close()], ['browserConnection', () => browser?.close()],
    ['browserServer', () => browserServer?.close()],
    ['server', async () => { server?.closeAllConnections(); if (server?.listening) await new Promise(ok => server.close(ok)); }],
  ]) { try { await close(); report.cleanup[name] = true; } catch { report.cleanup[name] = false; } }
  if (report.browser) report.cleanup.browserReaped = await processIdentity(report.browser.pid) !== report.browser.start;
  try { await rm(owned, { recursive: true }); report.cleanup.tempRemoved = true; } catch { report.cleanup.tempRemoved = false; }
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg(); report.durationMs = Date.now() - Date.parse(report.startedAt);
  report.ok = !report.failure && report.cases.length === cases.length && report.checks.length === 117 && report.checks.every(c => c.ok) &&
    report.pageErrors === 0 && report.externalRequests === 0 && report.forbiddenSockets === 0 && Object.values(report.cleanup).every(Boolean);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, ok: report.ok, checks: report.checks.length, durationMs: report.durationMs }));
  if (!report.ok) process.exitCode = 1;
}
