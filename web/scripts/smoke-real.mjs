// End-to-end app check. Serve the release with its production CSP; workers can
// reach only the loopback fixture relay. Public HTTP is blocked in all contexts.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from '../../scripts/browser-relay.mjs';

const root = new URL('../../', import.meta.url).pathname;
process.chdir(root);
process.env.TMPDIR ??= `${root}tmp/temp`;
process.env.XDG_CACHE_HOME ??= `${root}tmp/cache`;
process.env.XDG_CONFIG_HOME ??= `${root}tmp/config`;
process.env.XDG_DATA_HOME ??= `${root}tmp/data`;
await mkdir(process.env.TMPDIR, { recursive: true });
const signer = spawn('cargo', ['run', '-q', '-p', 'lkjstr-core', '--example', 'engine-fixtures'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
signer.stderr.resume();
const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
const fixture = JSON.parse((await lines.next()).value);
const fake = fakeRelay();
for (const event of [fixture.note, ...fixture.events]) fake.add(event);
let signing = Promise.resolve();
const relay = createServer();
const ws = new bundle.wsServer({ server: relay });
const activePaths = new Map(); // bound by the engine's eight relay connections
ws.on('connection', (socket, req) => {
  activePaths.set(socket, req.url);
  socket.on('close', () => activePaths.delete(socket));
  fake.route({
    send: (text) => socket.send(text),
    onMessage: (fn) => socket.on('message', fn),
    onClose: (fn) => socket.on('close', fn),
  });
});
await new Promise((done) => relay.listen(0, '127.0.0.1', done));
const relayUrl = `ws://127.0.0.1:${relay.address().port}`;
signer.stdin.write(
  `${JSON.stringify({ pubkey: fixture.note.pubkey, created_at: Math.floor(Date.now() / 1000), kind: 10002, tags: [['r', `${relayUrl}/owner`]], content: '' })}\n`,
);
fake.add(JSON.parse((await lines.next()).value));
const server = spawn(
  process.execPath,
  ['web/scripts/serve.ts', '--port=0', `--test-relay=${relayUrl}`],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
const errors = [],
  checks = {};
const check = (name, ok = true) => {
  checks[name] = ok ? 'ok' : 'FAIL';
  if (!ok) throw new Error(name);
};
let browser, page;
try {
  const base = await new Promise((done, fail) => {
    server.stdout.once('data', (data) => done(String(data).trim()));
    server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
  browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    args: ['--no-sandbox', '--disable-background-networking'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await ctx.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  await ctx.exposeFunction('fixtureSign', (event) => {
    const task = signing.then(async () => {
      signer.stdin.write(`${JSON.stringify(event)}\n`);
      return JSON.parse((await lines.next()).value);
    });
    signing = task.then(() => undefined);
    return task;
  });
  await ctx.addInitScript(
    ({ relayUrl, pubkey }) => {
      if (location.protocol !== 'http:') return;
      if (!localStorage.getItem(`lkjstr:relays:${pubkey}`))
        localStorage.setItem(
          `lkjstr:relays:${pubkey}`,
          JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
        );
      if (!localStorage.getItem('lkjstr:relays:'))
        localStorage.setItem(
          'lkjstr:relays:',
          JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
        );
      globalThis.nostr = {
        getPublicKey: async () => pubkey,
        signEvent: (event) => globalThis.fixtureSign(event),
      };
    },
    { relayUrl, pubkey: fixture.note.pubkey },
  );
  ctx.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
  page = await ctx.newPage();
  const launch = async (word, kind) => {
    await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
    await page.keyboard.type(word);
    await page.locator('.ncard > b').getByText(word, { exact: true }).click();
    await page.locator(`.pane.cur .view[data-kind="${kind}"]:visible`).waitFor();
  };
  await page.goto(base);
  await page.locator('.view[data-kind="global"] .note').first().waitFor();
  check('global renders verified fixture notes');
  // UI gap: no account.add control exists. Set up the fixture account through a
  // second real adapter port, then exercise app signing/composition through its UI.
  await page.evaluate(async (relayUrl) => {
    const url = document.querySelector('link[rel=modulepreload]').href;
    const { workerTransport } = await import(url);
    const t = workerTransport({
      relays: [{ url: relayUrl, read: true, write: true, search: true }],
    });
    await new Promise((done, fail) => {
      t.listen((m) => {
        if (m.t === 'ready')
          t.post({
            t: 'act',
            req: 'fixture-login',
            action: { a: 'account.add', how: 'extension' },
          });
        if (m.t === 'result' && m.req === 'fixture-login')
          m.ok ? done() : fail(new Error(m.error?.code));
      });
    });
    t.close();
  }, relayUrl);
  await page.locator('.view[data-kind="home"] .note').first().waitFor();
  check('home renders signed-in notes');
  await page.locator('.view[data-kind="home"] .note .text').first().click();
  await page.locator('.th-focus').waitFor();
  check('note opens as thread');
  await page.locator('.th-focus .name').first().click();
  await page.locator('.profile').waitFor();
  check('profile opens');
  await launch('Search', 'search');
  await page.locator('.view[data-kind="search"] input').first().fill('Engine fixture');
  await page.locator('.view[data-kind="search"] input').first().press('Enter');
  await page.locator('.view[data-kind="search"] .note').first().waitFor();
  for (let n = 0; n < 200 && !fake.searches.includes('Engine fixture'); n++)
    await page.waitForTimeout(25);
  check('search returns relay result', fake.searches.includes('Engine fixture'));
  await launch('Write', 'compose');
  const text = `real engine smoke ${Date.now()}`;
  await page.locator('.pane.cur .view[data-kind="compose"]:visible textarea').fill(text);
  await page
    .locator('.pane.cur .view[data-kind="compose"]:visible')
    .getByRole('button', { name: 'Post', exact: true })
    .click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.cresult')].some((e) => e.textContent?.includes('Delivered')),
  );
  check(
    'note signed and published',
    fake.published.some((e) => e.kind === 1 && e.content === text),
  );
  await page.locator('.tab[data-view="global"]').click();
  await page.locator('.view[data-kind="global"] .note').filter({ hasText: text }).waitFor();
  check('published note appears in feed');
  await page
    .locator('.view[data-kind="global"] .note')
    .filter({ hasText: text })
    .locator('.a-heart')
    .click();
  await page.waitForTimeout(8500);
  check(
    'reaction reaches relay',
    fake.published.some((e) => e.kind === 7),
  );
  await launch('Settings', 'settings');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  check('settings persist after reload');
  const other = await ctx.newPage();
  await other.goto(base);
  await other.locator('.tab[data-view="global"]').click();
  await other.locator('.view[data-kind="global"] .note').first().waitFor();
  check('second app tab receives notes');
  for (let n = 0; n < 200 && fake.connections() !== 1; n++) await page.waitForTimeout(25);
  check('two app tabs share one relay socket', fake.connections() === 1);
  check(
    'learned owner relays survive reload and another tab bootstrap',
    [...activePaths.values()].every((path) => path === '/owner'),
  );
  check('no page errors', errors.length === 0);
} catch (error) {
  checks.failure = String(error);
  if (page) await writeFile('tmp/smoke-real-dom.txt', await page.locator('body').innerText());
} finally {
  await mkdir('tmp/smoke-real', { recursive: true });
  await writeFile(
    'tmp/smoke-real/report.json',
    JSON.stringify(
      {
        checks,
        errors,
        publications: fake.published.map((e) => ({ id: e.id, kind: e.kind })),
        searches: fake.searches,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  server.kill();
  signer.stdin.end();
  ws.close();
  await new Promise((done) => relay.close(done));
}
if (Object.values(checks).some((v) => v !== 'ok')) {
  console.error(JSON.stringify({ checks, errors }));
  process.exitCode = 1;
} else console.log('ok smoke-real');
