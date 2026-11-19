// Real packaged bytes, fresh origin/context. No relay publication or saved account.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { shellBrowser } from './offline-browser.mjs';
import { waitFor } from './offline-fixture.mjs';
import { shellWorker } from './shell-cache.ts';
import { shellHandoff } from './smoke-offline-handoff.mjs';
import { shellRaces } from './smoke-offline-races.mjs';
import { shellUpdates } from './smoke-offline-updates.mjs';

const root = resolve('../dist');
const original = await readFile(join(root, 'sw.js'), 'utf8');
const index = await readFile(join(root, 'index.html'), 'utf8');
const assets = JSON.parse(original.match(/const assets = (.*);/)[1]);
const marker = 'offline-update-fixture';
const next = shellWorker([
  ...assets,
  ['/shell-update.js', createHash('sha256').update(marker).digest('hex')],
]);
let phase = 'old';
const requests = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://test').pathname;
  if (['/sw.js', '/shell-update.js', '/fixture'].includes(path))
    requests.push({ path, phase, at: Date.now() });
  res.setHeader('cache-control', 'no-store');
  if (path === '/fixture')
    return res
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><title>Offline shell verification</title>');
  if (path === '/sw.js')
    return res
      .writeHead(200, { 'content-type': 'text/javascript' })
      .end(phase === 'old' ? original : next);
  if (path === '/shell-update.js')
    return phase === 'broken'
      ? res.writeHead(200, { 'content-type': 'text/javascript' }).end('wrong bytes')
      : res.writeHead(200, { 'content-type': 'text/javascript' }).end(marker);
  try {
    const body = await readFile(join(root, path));
    const type = {
      '.js': 'text/javascript',
      '.html': 'text/html',
      '.wasm': 'application/wasm',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.webmanifest': 'application/manifest+json',
    }[extname(path)];
    res.writeHead(200, { 'content-type': type ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await shellBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/fixture`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('shell installation timeout')), 30000),
      ),
    ]);
  });
  await page.reload();
  await waitFor(page, () => !!navigator.serviceWorker.controller);
  const first = await page.evaluate(() => caches.keys());
  assert.equal(first.length, 1);
  assert.equal(await page.evaluate(async () => (await fetch('/index.html')).text()), index);
  await context.setOffline(true);
  const cached = await page.evaluate(
    async (paths) => Promise.all(paths.map(async (path) => ({ path, ok: (await fetch(path)).ok }))),
    assets.map(([path]) => path),
  );
  assert.ok(
    cached.every((row) => row.ok),
    'entire verified shell works without network',
  );
  await context.setOffline(false);
  assert.equal(
    await page.evaluate(async () => (await fetch('/fixture', { cache: 'no-store' })).status),
    200,
  );
  // This Chromium delayed the first update request by 60s after offline emulation.
  // Keep a bounded lifecycle wait; assert the corrupt asset was actually requested.
  phase = 'broken';
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await new Promise((resolve, reject) => {
      const observed = [];
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `failed update timeout ${JSON.stringify({ observed, installing: r.installing?.state, waiting: r.waiting?.state, active: r.active?.state })}`,
            ),
          ),
        90000,
      );
      r.addEventListener(
        'updatefound',
        () => {
          const w = r.installing;
          observed.push({ event: 'updatefound', state: w?.state });
          w.addEventListener('statechange', () => {
            observed.push({ event: 'statechange', state: w.state });
            if (w.state === 'redundant') {
              clearTimeout(timer);
              resolve();
            }
          });
        },
        { once: true },
      );
      r.update()
        .then(() => observed.push({ event: 'updated', state: r.installing?.state }))
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  });
  assert.ok(requests.some((r) => r.path === '/shell-update.js' && r.phase === 'broken'));
  assert.deepEqual(
    await page.evaluate(() => caches.keys()),
    first,
    'bad update cannot erase active shell',
  );
  phase = 'new';
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('new update timeout')), 90000);
      r.update().then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  });
  await waitFor(page, async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  const waiting = await page.evaluate(() => caches.keys());
  assert.equal(waiting.length, 2, 'new complete shell waits alongside old cache');
  assert.ok(waiting.includes(first[0]));
  const secondTab = await context.newPage();
  await secondTab.goto(`${origin}/fixture`);
  await page.close();
  await waitFor(secondTab, async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(await secondTab.evaluate(async () => (await fetch('/index.html')).text()), index);
  await secondTab.close();
  const fresh = await context.newPage();
  await fresh.goto(`${origin}/fixture`);
  await waitFor(fresh, async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r.active?.state === 'activated' && !r.waiting && !r.installing;
  });
  await fresh.reload();
  await waitFor(fresh, () => !!navigator.serviceWorker.controller);
  await waitFor(fresh, async () => (await caches.keys()).length === 1);
  const final = await fresh.evaluate(() => caches.keys());
  assert.equal(final.length, 1, 'old shell is released after last old tab closes');
  assert.notEqual(final[0], first[0]);
  await context.setOffline(true);
  assert.equal(await fresh.evaluate(async () => (await fetch('/shell-update.js')).text()), marker);
  const navigation = await fresh.goto(`${origin}/p/${'a'.repeat(64)}`);
  assert.equal(navigation?.status(), 200);
  assert.equal(await navigation?.text(), index, 'profile deep link uses the cached app shell');
  await context.close();
  console.log(
    'ok offline shell (integrity, offline assets, failed update, two tabs, activation, deep link)',
  );
} finally {
  try {
    await writeFile(resolve('../tmp/offline-requests.json'), JSON.stringify(requests, null, 2));
  } finally {
    try {
      await browser?.close();
    } finally {
      await new Promise((done) => {
        server.closeAllConnections();
        server.close(done);
      });
    }
  }
}

await shellUpdates();
await shellRaces();
await shellHandoff();
