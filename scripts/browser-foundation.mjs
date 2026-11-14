// Signed mixed-language design review; all HTTP/WS remain local or intercepted.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fakeRelay } from './browser-relay.mjs';

const out = resolve('tmp/screens');
await mkdir(out, { recursive: true });
const fixture = spawnSync('cargo', ['run', '-q', '-p', 'lkjstr-protocol', '--example', 'design-fixtures'], { encoding: 'utf8' });
if (fixture.status !== 0) throw new Error('design fixture helper failed');
const data = JSON.parse(fixture.stdout);
const root = resolve(process.env.LKJSTR_DIST ?? 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const file = join(root, new URL(req.url, 'http://x').pathname === '/' ? 'index.html' : new URL(req.url, 'http://x').pathname);
  try { res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;
const base = `${process.env.HOME}/.cache/ms-playwright`;
const dir = (await readdir(base)).filter((d) => d.startsWith('chromium-')).sort().pop();
const browser = await chromium.launch({ executablePath: process.env.LKJSTR_CHROME ?? `${base}/${dir}/chrome-linux64/chrome`, args: ['--no-sandbox'] });
const checks = {}, screenshots = [], errors = [];
const check = (name, ok) => { checks[name] = ok ? 'ok' : 'FAIL'; };
const harbor = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#c3d2da"/><path d="M0 320 170 250 370 330 600 210 900 290 1200 170V675H0" fill="#738b94"/><path d="M0 390Q400 340 1200 420V675H0" fill="#527b91"/><path d="M0 470Q400 420 1200 490M0 540Q600 500 1200 550" stroke="#d3e1e5" stroke-width="5" fill="none"/><path d="M760 450h160l-25 25H790Z" fill="#f4f3ee"/><path d="M838 280v170M840 285l64 130h-64" stroke="#f4f3ee" stroke-width="5" fill="#e2e0d8"/></svg>`;
const coffee = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><text x="1" y="27" font-size="28">☕</text></svg>`;
try {
  for (const [size, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    for (const theme of ['light', 'dark']) {
      const fake = fakeRelay();
      for (const event of data.events) fake.add(event);
      const context = await browser.newContext({ viewport, colorScheme: theme, locale: 'en-US' });
      await context.routeWebSocket(/.*/, fake.route);
      await context.route('**/*', (route) => {
        const target = route.request().url();
        if (target.startsWith(url)) return route.continue();
        if (target === 'https://media.fixture.invalid/harbor.svg') return route.fulfill({ contentType: 'image/svg+xml', body: harbor });
        if (target === 'https://media.fixture.invalid/coffee.svg') return route.fulfill({ contentType: 'image/svg+xml', body: coffee });
        return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(url);
      await page.waitForSelector('.pane');
      await page.evaluate(async (events) => {
        const db = await new Promise((ok, fail) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); r.onerror = fail; });
        await new Promise((ok, fail) => {
          const tx = db.transaction(['events', 'kv'], 'readwrite');
          tx.objectStore('kv').put(JSON.stringify({ accounts: [{ pubkey: events[0].pubkey, signer: 'readonly' }], active: events[0].pubkey }), 'session');
          for (const e of events) tx.objectStore('events').put({ id: e.id, created_at: e.created_at, raw: JSON.stringify(e) });
          tx.oncomplete = ok; tx.onerror = fail;
        });
        db.close();
      }, data.events);
      await page.reload();
      await page.waitForSelector('.pane');
      const shot = async (view) => {
        await page.waitForTimeout(180);
        const name = `${size}-${theme}-${view}.png`;
        await page.screenshot({ path: join(out, name) }); screenshots.push(name);
      };
      const open = async (label) => {
        await page.locator('.brand').click();
        await page.keyboard.press('Control+k');
        await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).first().click();
      };
      await open('Welcome');
      await shot('welcome');
      await open('Global');
      await page.locator('.pane.focused .body.shown .note').first().waitFor();
      if (size === 'phone') {
        const width = await page.locator('.pane.focused').evaluate((el) => el.getBoundingClientRect().width);
        check(`390x844 ${theme} focused tile fills width`, width >= 389 && width <= 390);
        check(`${theme} bottom navigation visible`, await page.locator('.bottom-bar').isVisible());
      }
      check(`${size} ${theme} data URL avatars load`, await page.locator('.pane.focused .body.shown .avatar img').first().evaluate((img) => img.complete && img.naturalWidth > 0));
      await shot('global');
      await page.locator('.pane.focused .body.shown .note').filter({ hasText: 'Burnout / 心の健康' }).first().scrollIntoViewIfNeeded();
      await shot('global-warning');
      await page.locator('.pane.focused .body.shown .note').filter({ hasText: '読み返したいノート / Notes to return to' }).first().scrollIntoViewIfNeeded();
      await shot('global-long-note');
      await page.locator('.pane.focused .body.shown .media').first().click();
      await page.locator('.pane.focused .body.shown .image-target').waitFor();
      await shot('image');
      await open('Global');
      // A public URL can also be restored directly from the address bar.
      await page.goto(url + '#view=' + encodeURIComponent(JSON.stringify({ kind: 'link', url: 'https://example.org/reading-notes' })));
      await page.locator('.pane.focused .body.shown a').filter({ hasText: 'Open website' }).waitFor();
      await shot('website');
      await open('Global');
      const before = await page.locator('.tab').count();
      await open('Global');
      check(`${size} ${theme} opening same view creates new tab`, await page.locator('.tab').count() === before + 1);
      await page.locator(`.pane.focused .body.shown .note[data-id="${data.root}"]`).first().click({ position: { x: 4, y: 12 } });
      await page.locator('.pane.focused .body.shown .thread .note.focused').waitFor();
      await shot('thread');
      await page.locator('.pane.focused .body.shown .thread .note.focused .name').click();
      await page.locator('.pane.focused .body.shown .profile-head').waitFor();
      await shot('profile');
      for (const label of ['Home', 'Notifications', 'Compose', 'Search', 'Relays', 'Accounts', 'Settings']) {
        await open(label);
        if (label === 'Notifications') {
          const row = page.locator('.pane.focused .body.shown .note.compact').first();
          await row.waitFor();
          const actor = await row.locator('.name').innerText();
          await row.locator('.avatar-button').click();
          await page.locator('.pane.focused .body.shown .profile-head h2').filter({ hasText: actor }).waitFor();
          check(`${size} ${theme} notification avatar opens actor profile`, true);
          await open('Notifications');
        }
        await shot(label.toLowerCase());
      }
      await page.locator('.pane.focused .body.shown').getByRole('combobox', { name: 'Language', exact: true }).selectOption('ja');
      await page.locator('.pane.focused h2').filter({ hasText: '設定' }).waitFor();
      check(`${size} ${theme} Japanese settings labels render`, await page.locator('.pane.focused').getByText('表示密度', { exact: true }).isVisible());
      await shot('settings-japanese');
      await page.locator('.pane.focused .body.shown').getByRole('combobox', { name: 'Language', exact: true }).selectOption('en');
      await page.locator('.pane.focused .body.shown').getByLabel('Compact', { exact: true }).check();
      await open('Global');
      const avatarWidth = await page.locator('.pane.focused .body.shown .note:not(.compact) .avatar').first().evaluate((el) => el.getBoundingClientRect().width);
      check(`${size} ${theme} compact density uses 28px avatars`, avatarWidth === 28);
      await shot('global-compact');
      await open('Settings');
      await page.locator('.pane.focused .body.shown').getByLabel('Comfortable', { exact: true }).check();
      await page.locator('.brand').click();
      await page.keyboard.press('Alt+t');
      await shot('launcher');
      await page.locator('.brand').click();
      await page.keyboard.press('?');
      await shot('shortcuts');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+k');
      await shot('palette');
      await page.keyboard.press('Escape');
      if (size === 'phone') await page.getByRole('button', { name: 'More', exact: true }).click();
      else await page.locator('.topbar .account').click();
      await shot(size === 'phone' ? 'more-sheet' : 'account-menu');
      await context.close();
    }
  }
  check('no page errors', errors.length === 0);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  await writeFile(join(out, 'report.json'), JSON.stringify({ checks, screenshots, errors }, null, 2));
  console.log(JSON.stringify({ checks, screenshots: screenshots.length, errors }));
}
if (Object.values(checks).some((v) => v !== 'ok')) process.exitCode = 1;
