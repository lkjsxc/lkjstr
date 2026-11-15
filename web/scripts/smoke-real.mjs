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
// The npub of a public key nobody here has metadata for (the curve's generator point: nobody's account).
const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const polymod = (values) => {
  let c = 1;
  for (const v of values) {
    const top = c >>> 25;
    c = ((c & 0x1ffffff) << 5) ^ v;
    [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((g, i) => {
      if ((top >>> i) & 1) c ^= g;
    });
  }
  return c;
};
const npubOf = (hex) => {
  const data = [];
  let acc = 0;
  let bits = 0;
  for (const byte of hex.match(/../g).map((h) => Number.parseInt(h, 16))) {
    acc = ((acc << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) data.push((acc >>> (bits -= 5)) & 31);
  }
  if (bits) data.push((acc << (5 - bits)) & 31);
  const mod = polymod([3, 3, 3, 3, 0, 14, 16, 21, 2, ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const sum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
  return `npub1${[...data, ...sum].map((i) => CH[i]).join('')}`;
};
const npub = npubOf('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
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
  // LKJSTR_SHOTS=1 also writes the review captures of this run to tmp/screens/.
  const shots = process.env.LKJSTR_SHOTS === '1';
  const shot = (p, name) => p.screenshot({ path: `tmp/screens/${name}` });
  /** A fresh visitor in a context of their own: no account, the loopback relay only. */
  const visit = async (options, path = '') => {
    const fresh = await browser.newContext(options);
    await fresh.route('**/*', (route) =>
      route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
    );
    await fresh.addInitScript((relayUrl) => {
      localStorage.setItem(
        'lkjstr:relays:',
        JSON.stringify([{ url: relayUrl, read: true, write: true, search: true }]),
      );
    }, relayUrl);
    const p = await fresh.newPage();
    p.on('pageerror', (error) => errors.push(String(error)));
    await p.goto(base + path);
    return p;
  };
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
  // A first visit, signed out: one tile of readable notes, nothing empty, the way in one press away.
  const firstRun = await page.evaluate(() => ({
    panes: document.querySelectorAll('.pane').length,
    tabs: [...document.querySelectorAll('.tab')].map((t) => t.getAttribute('data-view')),
    empty: [...document.querySelectorAll('.fstate')].map((e) => e.textContent).join(''),
    signIn: document.querySelector('.acct.out')?.textContent,
    oneLine: (document.querySelector('.acct.out')?.getBoundingClientRect().height ?? 99) < 30,
    off: document.querySelectorAll('.act.off').length > 0,
    hex: /[0-9a-f]{64}/.test(document.body.innerText),
  }));
  check(
    'signed-out first run is readable, with no empty tile',
    firstRun.panes === 1 &&
      firstRun.tabs.join() === 'global' &&
      firstRun.empty === '' &&
      firstRun.signIn === 'Sign in' &&
      firstRun.oneLine &&
      firstRun.off &&
      !firstRun.hex,
  );
  if (shots) await shot(page, 'slice-firstrun-loopback-1440.png');
  // Sign in through the interface: the Accounts tab, the browser extension (the fixture signer).
  await page.locator('.acct.out').click();
  const accounts = '.view[data-kind="account"]:visible';
  await page.locator(`${accounts} [data-f="extension"]`).waitFor();
  check(
    'sign-in offers the extension and a key field that never echoes; no account is created without a way to its key',
    (await page.locator(`${accounts} input`).getAttribute('type')) === 'password' &&
      (await page.locator(`${accounts} [data-f="create"]`).isHidden()),
  );
  // The same surface on a phone, dark, in Japanese: the bar fits on one line and nothing is clipped.
  const phone = await visit({
    viewport: { width: 390, height: 844 },
    locale: 'ja-JP',
    colorScheme: 'dark',
  });
  await phone.locator('.view[data-kind="global"] .note').first().waitFor();
  await phone.locator('.acct.out').click();
  await phone.locator('.view[data-kind="account"] [data-f="extension"]').waitFor();
  const bar = await phone.evaluate(() => {
    const chips = [...document.querySelectorAll('lkjstr-spaces button')];
    const strip = document.querySelector('lkjstr-spaces').getBoundingClientRect();
    return {
      chips: chips.filter((c) => {
        const b = c.getBoundingClientRect();
        return b.left >= strip.left - 1 && b.right <= strip.right + 1;
      }).length,
      faded: document.querySelector('lkjstr-spaces').className,
      signIn: document.querySelector('.acct.out').getBoundingClientRect().height,
      wide: document.documentElement.scrollWidth - innerWidth,
    };
  });
  check(
    'phone top bar: nine workspaces whole, Sign in on one line',
    bar.chips === 9 && !bar.faded.includes('more') && bar.signIn < 30 && bar.wide <= 0,
  );
  if (shots) {
    await phone.waitForTimeout(300);
    await shot(phone, 'slice-signin-390-dark-ja.png');
  }
  await phone.context().close();
  // A person nobody has metadata for: a short npub for a name, no hex anywhere, no count that is not known.
  const stranger = await visit(
    { viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: 'dark' },
    `/p/${npub}`,
  );
  await stranger.locator('.profile').waitFor();
  await stranger.waitForTimeout(800);
  const pending = await stranger.evaluate(() => ({
    name: document.querySelector('.pname').textContent,
    lines: Math.round(
      document.querySelector('.pname').getBoundingClientRect().height /
        Number.parseFloat(getComputedStyle(document.querySelector('.pname')).lineHeight),
    ),
    tab: document.querySelector('.tab.active > span').textContent,
    stats: document.querySelector('.pstats').textContent,
    hex: /[0-9a-f]{64}/.test(document.body.innerText),
  }));
  check(
    'a profile without metadata shows a short npub and no unknown count',
    /^npub1.{5}…/.test(pending.name) &&
      pending.lines === 1 &&
      pending.tab === pending.name &&
      !/\d/.test(pending.stats) &&
      !pending.hex,
  );
  if (shots) await shot(stranger, 'slice-profile-pending-1440-dark.png');
  await stranger.context().close();
  await page.locator(`${accounts} input`).fill('not a key');
  await page.locator(`${accounts} input`).press('Enter');
  await page.locator(`${accounts} .asaid.error`).waitFor();
  check(
    'a wrong key is refused in words, and is gone from the field and the page',
    (await page.locator(`${accounts} input`).inputValue()) === '' &&
      !(await page.locator('body').innerText()).includes('not a key'),
  );
  await page.locator(`${accounts} [data-f="extension"]`).click();
  await page.locator('.view[data-kind="home"] .note').first().waitFor();
  check('home renders signed-in notes');
  check(
    'signing in brings the ordinary layout',
    (await page.locator('.pane').count()) === 4 &&
      (await page.locator('.acct:not(.out) .av').count()) === 1 &&
      (await page.evaluate(() => typeof JSON.parse(localStorage.getItem('lkjstr:account')))) ===
        'string',
  );
  if (shots) {
    await page.waitForTimeout(600);
    await shot(page, 'slice-signedin-loopback-1440.png');
  }
  await page.locator('.view[data-kind="home"] .note .text').first().click();
  await page.locator('.th-focus').waitFor();
  check('note opens as thread');
  await page.locator('.th-focus .name').first().click();
  await page.locator('.profile').waitFor();
  check('profile opens');
  // A second account that is only a public key: read-only is plain before anything is pressed.
  await page.locator('.acct').click();
  await page.locator('.menu button', { hasText: 'Accounts' }).click();
  await page.locator(`${accounts} input`).fill(npub);
  await page.locator(`${accounts} input`).press('Enter');
  await page.locator(`${accounts} .arow`).nth(1).waitFor();
  await page.locator('.acct .ro').waitFor();
  await page.locator('.view[data-kind="compose"] .cwho .badge').first().waitFor();
  check(
    'a read-only account says so at the composer and on every action',
    (await page.locator('.view[data-kind="compose"] .btn.primary:visible').first().isDisabled()) &&
      (await page.locator('.note .act.off').count()) > 0 &&
      (await page.locator('.note .act.a-reply:not(.off)').count()) === 0,
  );
  await page.locator('.note .act.a-heart').first().click({ force: true });
  await page.locator('.toast', { hasText: 'read-only' }).waitFor();
  check(
    'a press on a read-only action says why and publishes nothing',
    fake.published.length === 0,
  );
  // Switch back from the top bar, then remove the read-only account (it goes at once, with an Undo).
  await page.locator('.acct').click();
  await page.locator('.menu button').first().click();
  await page.waitForFunction(() => !document.querySelector('.acct .ro'));
  check(
    'switching accounts changes who posts',
    (await page.locator('.note .act.off').count()) === 0 &&
      (await page.locator(`${accounts} .arow.on`).count()) === 1,
  );
  await page.locator(`${accounts} .arow:not(.on) [data-f="remove"]`).click();
  await page.locator('.toast.undo').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.arow').length === 1);
  check('a read-only account is removed at once');
  await page.locator('.tab.active[data-view^="account"] > .x').click();
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
  // Signed out again: the visitor's layout returns, here and in the other tab, and stays after a reload.
  await page.locator('.acct').click();
  await page.locator('.menu button', { hasText: 'Accounts' }).click();
  await page.locator(`${accounts} [data-f="remove"]`).click();
  await page.locator('.acct.out').waitFor();
  await other.locator('.acct.out').waitFor();
  const out = async (p) =>
    (await p.locator('.pane').count()) === 1 &&
    (await p.locator('.view[data-kind="home"]').count()) === 0 &&
    (await p.evaluate(() => localStorage.getItem('lkjstr:account'))) === null;
  check('removing the last account signs out everywhere', (await out(page)) && (await out(other)));
  await page.reload();
  await page.locator('.view[data-kind="global"] .note').first().waitFor();
  check('signed out survives a reload', await out(page));
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
