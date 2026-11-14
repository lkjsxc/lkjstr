// Browser smoke for the built app (dist/). Every WebSocket is routed to an
// in-process fake relay, so nothing reaches public relays and results are
// repeatable. Usage: node scripts/browser-smoke.mjs [out-dir]
// Prints one JSON object of checks; exits 1 if any check fails.
import { createServer } from 'node:http';
import { readFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { fakeRelay } from './browser-relay.mjs';
import { browserFlows } from './browser-flows.mjs';
import { browserReview } from './browser-review.mjs';

const root = resolve(process.env.LKJSTR_DIST ?? 'dist');
const out = resolve(process.argv[2] ?? 'tmp/smoke');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(root, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file.startsWith(root) ? file : join(root, 'index.html'));
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;

async function chrome() {
  if (process.env.LKJSTR_CHROME) return process.env.LKJSTR_CHROME;
  const base = `${process.env.HOME}/.cache/ms-playwright`;
  const dir = (await readdir(base)).filter((d) => d.startsWith('chromium-')).sort().pop();
  return `${base}/${dir}/chrome-linux64/chrome`;
}

const fake = fakeRelay();
const stored = fake.published;

const checks = {};
let diagnostics;
const check = (name, ok, detail = '') => (checks[name] = ok ? 'ok' : `FAIL ${detail}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: await chrome(), args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await context.routeWebSocket(/.*/, fake.route);
// Block all external HTTP as well as intercepting every WebSocket.
await context.route('**/*', (route) => route.request().url().startsWith(url) ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
const assetErrors = [];
page.on('response', (r) => { if (r.url().startsWith(url) && r.status() >= 400) assetErrors.push(r.status()); });
page.on('requestfailed', (r) => { if (r.url().startsWith(url)) assetErrors.push(r.failure()?.errorText); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const panes = () => page.locator('.pane').count();

try {
  await page.goto(url);
  await page.waitForSelector('.pane', { timeout: 20000 });
  check('boot shows tiled workspace', (await panes()) >= 3);
  await shot('01-welcome');

  await page.click('.topbar .account');
  await page.click('text=Create a new key');
  await page.waitForSelector('.accounts li.active', { timeout: 5000 });
  check('local key created and active', (await page.locator('.accounts li').count()) === 1);

  const compose = page.locator('.pane textarea').first();
  await compose.fill('Hello from the lkjstr smoke test #lkjstr');
  await compose.press('Control+Enter');
  await page.waitForSelector('text=/accepted by \\d+ of/', { timeout: 15000 });
  check('publish accepted by fake relay', stored.some((e) => e.kind === 1));
  await page.click('.tab:has-text("Home")');
  const note = page.locator('.pane .body.shown .note:has-text("Hello from the lkjstr smoke test")').first();
  await note.waitFor({ timeout: 10000 });
  check('own note appears in Home', true);
  await shot('02-home-posted');

  await note.click();
  await page.waitForSelector('.tab:has-text("Thread")', { timeout: 5000 });
  check('note opens thread beside', (await page.locator('.note.focused').count()) >= 1);
  await page.locator('.note.focused >> text=Reply').click();
  const reply = page.locator('.pane.focused textarea');
  await reply.fill('A reply in the thread');
  await reply.press('Control+Enter');
  await page.waitForFunction(() => document.querySelectorAll('.thread .note').length >= 2, null, { timeout: 15000 });
  check('reply shows in thread', true);
  await page.locator('.thread .note').first().locator('text=Like').click();
  await page.waitForSelector('.thread .note button.on', { timeout: 10000 });
  check('like toggles on', stored.some((e) => e.kind === 7));
  await shot('03-thread');

  const before = await panes();
  await page.keyboard.press('Alt+Backslash');
  check('Alt+\\ splits the focused tile', (await panes()) === before + 1, `${before} -> ${await panes()}`);
  await page.keyboard.press('Alt+KeyW');
  await page.keyboard.press('Alt+KeyH');
  check('Alt+H moves focus', (await page.locator('.pane.focused').count()) === 1);
  const layout = await panes();
  await page.waitForTimeout(800);

  // waitForFunction treats a returned Promise as truthy, even when it resolves
  // false. Poll the awaited database result before navigating away from writes.
  let cacheCommitted = false;
  for (let n = 0; n < 100 && !cacheCommitted; n++) {
    cacheCommitted = await page.evaluate(async () => {
      const db = await new Promise((ok) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); });
      const count = await new Promise((ok) => { const r = db.transaction('events').objectStore('events').count(); r.onsuccess = () => ok(r.result); });
      db.close();
      return count >= 3;
    });
    if (!cacheCommitted) await page.waitForTimeout(100);
  }
  if (!cacheCommitted) throw new Error('Event cache did not commit before reload');
  fake.setReading(false);
  await page.reload();
  await page.waitForSelector('.pane', { timeout: 20000 });
  check('layout persists across reload', (await panes()) === layout, `${layout} vs ${await panes()}`);
  check('account persists across reload', !(await page.locator('.topbar .account').innerText()).includes('Sign in'));
  await page.click('.tab:has-text("Home")');
  await page.waitForSelector('.body.shown .note:has-text("Hello from the lkjstr smoke test")', { timeout: 10000 });
  check('cached note renders after reload without relay replay', true);
  fake.setReading(true);
  await page.click('.tab:has-text("Notifications")');
  await page.waitForSelector('.body.shown >> text=No replies, mentions or reactions yet.', { timeout: 10000 });
  check('notifications ask relays and settle honestly', true);
  await browserFlows(page, fake, check, shot);
  await browserReview(browser, url, stored.find((e) => e.kind === 1), check);

  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  const visible = await page.locator('.pane:visible').count();
  check('narrow screen shows one tile', visible === 1, `${visible} visible`);
  await shot('04-narrow');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await shot('05-light');
} catch (error) {
  const focused = await page.locator('.pane.focused').innerText().catch(() => '');
  check('run completed', false, `${String(error).split('\n')[0]} | focused: ${focused.slice(0, 300)}`);
  diagnostics = await page.evaluate(async () => {
    const db = await new Promise((ok) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); });
    const rows = await new Promise((ok) => { const r = db.transaction('events').objectStore('events').getAll(); r.onsuccess = () => ok(r.result); });
    const session = await new Promise((ok) => { const r = db.transaction('kv').objectStore('kv').get('session'); r.onsuccess = () => ok(r.result); });
    db.close();
    return { active: JSON.parse(session ?? '{}').active, events: rows.map((r) => { const e = JSON.parse(r.raw); return { id: e.id, pubkey: e.pubkey, kind: e.kind }; }) };
  }).catch(() => undefined);
  await shot('99-failure').catch(() => {});
}
check('built assets load without HTTP errors', assetErrors.length === 0, assetErrors.join(' | '));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const report = JSON.stringify({ url, out, published: stored.length, checks, diagnostics }, null, 1);
await writeFile(join(out, 'report.json'), report + '\n');
console.log(report);
await browser.close();
await new Promise((done) => server.close(done));
process.exit(Object.values(checks).every((v) => v === 'ok') ? 0 : 1);
