// Browser smoke for the built app (dist/). Every WebSocket is routed to an
// in-process fake relay, so nothing reaches public relays and results are
// repeatable. Usage: node scripts/browser-smoke.mjs [out-dir]
// Prints one JSON object of checks; exits 1 if any check fails.
import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve('dist');
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

// Fake relay: stores published events (bounded) and answers REQs from them.
const stored = [];
const matches = (e, f) =>
  (!f.ids || f.ids.includes(e.id)) &&
  (!f.authors || f.authors.includes(e.pubkey)) &&
  (!f.kinds || f.kinds.includes(e.kind)) &&
  (!f.since || e.created_at >= f.since) &&
  (!f.until || e.created_at <= f.until) &&
  Object.entries(f)
    .filter(([k]) => k.startsWith('#'))
    .every(([k, v]) => e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));
function relay(ws) {
  ws.onMessage((raw) => {
    const msg = JSON.parse(String(raw));
    if (msg[0] === 'EVENT') {
      if (stored.length < 1000 && !stored.some((e) => e.id === msg[1].id)) stored.push(msg[1]);
      ws.send(JSON.stringify(['OK', msg[1].id, true, '']));
    } else if (msg[0] === 'REQ') {
      const [, sub, ...filters] = msg;
      for (const e of stored) if (filters.some((f) => matches(e, f))) ws.send(JSON.stringify(['EVENT', sub, e]));
      ws.send(JSON.stringify(['EOSE', sub]));
    }
  });
}

const checks = {};
const check = (name, ok, detail = '') => (checks[name] = ok ? 'ok' : `FAIL ${detail}`);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: await chrome(), args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await context.routeWebSocket(/.*/, relay);
const page = await context.newPage();
const errors = [];
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

  await page.reload();
  await page.waitForSelector('.pane', { timeout: 20000 });
  check('layout persists across reload', (await panes()) === layout, `${layout} vs ${await panes()}`);
  check('account persists across reload', !(await page.locator('.topbar .account').innerText()).includes('Sign in'));
  await page.click('.tab:has-text("Home")');
  await page.waitForSelector('.body.shown .note:has-text("Hello from the lkjstr smoke test")', { timeout: 10000 });
  check('cached note renders after reload', true);
  await page.click('.tab:has-text("Notifications")');
  await page.waitForSelector('.body.shown >> text=No replies, mentions or reactions yet.', { timeout: 10000 });
  check('notifications ask relays and settle honestly', true);

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
  await shot('99-failure').catch(() => {});
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(JSON.stringify({ url, out, published: stored.length, checks }, null, 1));
await browser.close();
server.close();
process.exit(Object.values(checks).every((v) => v === 'ok') ? 0 : 1);
