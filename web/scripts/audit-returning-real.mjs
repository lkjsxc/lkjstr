// Upgrade the actual historical WASM apps over the same browser origin, storage, IndexedDB and HTTP cache.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { auditCsp, historicalCacheHit } from './audit-browser.ts';
import { installExtension } from './smoke-visitors.mjs';

const root = new URL('../../', import.meta.url).pathname;
process.chdir(root);
const signer = spawn('cargo', ['run', '-q', '-p', 'lkjstr-core', '--example', 'engine-fixtures'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
signer.stderr.resume();
const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
const fixture = JSON.parse((await lines.next()).value);
const fake = fakeRelay();
for (const event of [fixture.note, ...fixture.events]) fake.add(event);
const relay = createServer();
const ws = new bundle.wsServer({ server: relay });
ws.on('connection', (socket) =>
  fake.route({
    send: (text) => socket.send(text),
    onMessage: (fn) => socket.on('message', fn),
    onClose: (fn) => socket.on('close', fn),
  }),
);
await new Promise((done) => relay.listen(0, '127.0.0.1', done));
const url = `ws://127.0.0.1:${relay.address().port}`;
let queue = Promise.resolve();
const sign = (event) => {
  const task = queue.then(async () => {
    signer.stdin.write(`${JSON.stringify(event)}\n`);
    return JSON.parse((await lines.next()).value);
  });
  queue = task.then(() => {});
  return task;
};
fake.add(
  await sign({
    pubkey: fixture.note.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 10002,
    content: '',
    tags: [['r', `${url}/owner`]],
  }),
);
fake.add(
  await sign({
    pubkey: fixture.note.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    content: 'Returning engine fixture, current day',
    tags: [],
  }),
);
let dist = 'dist';
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = `${dist}${path === '/' ? '/index.html' : path}`;
  if (path.includes('..') || !existsSync(file)) return res.writeHead(404).end();
  const type =
    {
      js: 'text/javascript',
      html: 'text/html',
      wasm: 'application/wasm',
      css: 'text/css',
      svg: 'image/svg+xml',
    }[file.split('.').at(-1)] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Security-Policy': auditCsp(url),
    'Cache-Control': file.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.LKJSTR_CHROME ??
    `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
  args: ['--no-sandbox'],
});
const results = {};
const errors = [];
const check = (name, ok) => {
  results[name] = ok ? 'ok' : 'FAIL';
  if (!ok) throw new Error(name);
};
try {
  for (const ref of ['af8c915e', 'dbd66e59'])
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        locale: 'en-US',
        colorScheme: 'dark',
      });
      await ctx.exposeFunction('fixtureSign', sign);
      await installExtension(ctx, url, fixture.note.pubkey, errors);
      const page = await ctx.newPage();
      page.setDefaultTimeout(20000);
      const name = `${ref}-${width}`;
      const launch = async (word) => {
        await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
        await page.keyboard.type(word);
        await page.locator('.ncard > b').getByText(word, { exact: true }).click();
      };
      try {
        dist = `tmp/history/${ref}/dist`;
        await page.goto(base);
        await page.locator('.note').first().waitFor();
        await page.locator('.acct.out').click();
        await page.locator('[data-f="extension"]').click();
        await page.locator('.view[data-kind="home"] .note').first().waitFor();
        check(`${name} old engine signs in and Home reads real signed fixture data`, true);
        if (ref === 'af8c915e') {
          await page.locator('.tab[data-view="home"]').click();
          await page.keyboard.press('/');
          await page.locator('.view[data-kind="home"] .rtoggle').click();
          await page
            .locator('.view[data-kind="home"] .rpanel')
            .getByRole('button', { name: '7 days', exact: true })
            .click();
        }

        if (ref === 'af8c915e' && width === 1440) {
          await page.locator('.tab[data-view="bookmarks"]').click();
          await page.locator('.tab[data-view="global"]').click();
        } else {
          await page.locator('.tab[data-view="global"]').click();
          await page.locator('.tab[data-view="home"]').click();
        }
        await page.waitForTimeout(550);
        // The old default is persisted independently, alongside the custom arrangement below.
        const original = await ctx.storageState({ indexedDB: true });
        await launch(ref === 'af8c915e' ? 'Shortcuts' : 'Docs');
        await launch('Settings');
        await page.getByLabel('Text size', { exact: true }).fill('18');
        await page.getByLabel('Text size', { exact: true }).press('Tab');
        await page.waitForTimeout(550);
        const before = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('lkjstr:layout:main')),
        );
        check(`${name} historical HTTP cache hit`, await historicalCacheHit(page));
        dist = 'dist';
        await page.reload();
        await page.locator('.view[data-kind="settings"]:visible').waitFor();
        const after = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('lkjstr:layout:main')),
        );
        const structure = (n) =>
          n.type === 'pane'
            ? { id: n.id }
            : { id: n.id, sizes: n.sizes, children: n.children.map(structure) };
        check(
          `${name} real custom arrangement and text size survive`,
          JSON.stringify(structure(before)) === JSON.stringify(structure(after)) &&
            (await page.getByLabel('Text size', { exact: true }).inputValue()) === '18',
        );
        check(
          `${name} no retired tab is dropped`,
          !JSON.stringify(after).includes('"shortcuts"') && JSON.stringify(after).includes('docs'),
        );
        if (ref === 'af8c915e') {
          await page.locator('.tab[data-view^="docs"]').first().click();
          check(
            `${name} retired Shortcuts keeps its page`,
            (await page
              .locator('.view[data-kind="docs"]:visible .ditem.on')
              .getAttribute('data-page')) === 'shortcuts',
          );
        }
        check(
          `${name} Post caption is current`,
          (await page.locator('.tab[data-view="compose"] > span').innerText()) === 'Post',
        );
        await page.locator('.tab[data-view="home"]').click();
        await page.locator('.view[data-kind="home"] .note').first().waitFor();
        check(`${name} real Home works after upgrade`, true);
        if (ref === 'af8c915e') {
          check(
            `${name} old period is repaired in the real browser`,
            await page.evaluate(() => {
              const f = JSON.parse(localStorage.getItem('lkjstr:view:main1:home')).filter;
              return typeof f.start === 'string' && f.range === undefined;
            }),
          );
        }

        await page.reload();
        await page.locator('.view[data-kind="home"] .note').first().waitFor();
        check(`${name} second real reload keeps Home`, true);
        await mkdir('tmp/screens', { recursive: true });
        if (process.env.LKJSTR_SHOTS === '1')
          await page.screenshot({ path: `tmp/screens/audit-06-real-returning-${name}.png` });
        // Upgrade untouched defaults, retaining the actual old engine's IndexedDB too.
        const plain = await browser.newContext({
          viewport: { width, height: 900 },
          locale: 'en-US',
          storageState: original,
        });
        await installExtension(plain, url, fixture.note.pubkey, errors);
        const p = await plain.newPage();
        await p.goto(base);
        await p.locator('.view[data-kind="home"] .note').first().waitFor();
        check(
          `${name} untouched real default upgrades`,
          (await p.locator('.pane').count()) === (width === 390 ? 1 : 3) &&
            (await p.locator('.tab[data-view="settings"]').count()) === 1,
        );
        await plain.close();
      } catch (e) {
        results[`${name} failure`] = e.message;
      } finally {
        await ctx.close();
      }
    }
  check('no public relay publications', fake.published.length === 0);
  check('no returning engine page errors', errors.length === 0);
} finally {
  await writeFile(
    'tmp/audit-returning-real.json',
    JSON.stringify({ checks: results, errors }, null, 2),
  );
  await browser.close();
  await new Promise((done) => server.close(done));
  signer.stdin.end();
  ws.close();
  await new Promise((done) => relay.close(done));
}
if (Object.values(results).some((v) => v !== 'ok')) {
  console.error(JSON.stringify(results));
  process.exitCode = 1;
} else console.log(`ok audit-returning-real ${Object.keys(results).length}`);
