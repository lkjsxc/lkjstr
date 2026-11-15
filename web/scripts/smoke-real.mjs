// End-to-end app check. Serve the release with its production CSP; workers can
// reach only the loopback fixture relay. Public HTTP is blocked in all contexts.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeBunker } from '../../scripts/browser-bunker.mjs';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { auditFixtures } from './audit-fixtures.mjs';
import { auditOwner } from './audit-owner.mjs';
import { channelScenarios } from './smoke-channels.mjs';
import { openKeyField, seedLayouts } from './smoke-seed.mjs';
import { signerFace, writeReport } from './smoke-signer-support.mjs';
import { signerScenarios } from './smoke-signers.mjs';
import { railSmoke } from './smoke-time-rail.ts';
import { accounts, installExtension, npub, visitorChecks } from './smoke-visitors.mjs';
import { wishes } from './smoke-wishes.mjs';

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
// Combined wishes, archive and owner-audit data retain at most 2000 loopback events.
const fake = fakeRelay({ maxEvents: 2000 });
const bunker = await fakeBunker();
for (const event of [fixture.note, ...fixture.events]) fake.add(event);
let signing = Promise.resolve();
const relay = createServer();
const ws = new bundle.wsServer({ server: relay });
const activePaths = new Map(); // bound by the engine's eight relay connections
ws.on('connection', (socket, req) => {
  if (req.url === '/bunker' || req.url === '/bunker-secret')
    return bunker.route(socket, req.url === '/bunker-secret');
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
  appendFileSync('tmp/smoke-real-progress.log', `${checks[name]} ${name}\n`);
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
  await seedLayouts(ctx);
  await ctx.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  const fixtureSign = (event) => {
    const task = signing.then(async () => {
      signer.stdin.write(`${JSON.stringify(event)}\n`);
      return JSON.parse((await lines.next()).value);
    });
    signing = task.then(() => undefined);
    return task;
  };
  await ctx.exposeFunction('fixtureSign', fixtureSign);
  await installExtension(ctx, relayUrl, fixture.note.pubkey, errors);
  // LKJSTR_SHOTS=1 also writes the review captures of this run to tmp/screens/.
  const shots = process.env.LKJSTR_SHOTS === '1';
  const shot = (p, name) => p.screenshot({ path: `tmp/screens/${name}` });
  const actor = await fixtureSign({ fixtureActor: true });
  fake.add(actor);
  let wishAt = Math.floor(Date.now() / 1000);
  const wishVersions = new Map();
  const addWish = async (kind, content, tags = [], as = actor.pubkey) => {
    const event = await fixtureSign({
      pubkey: as,
      created_at:
        kind === 0 || kind === 3
          ? (() => {
              const key = `${as}:${kind}`;
              const at = Math.max(Math.floor(Date.now() / 1000), (wishVersions.get(key) ?? 0) + 1);
              wishVersions.set(key, at);
              return at;
            })()
          : Math.floor(Date.now() / 1000),
      kind,
      content,
      tags,
    });
    fake.add(event);
    return event;
  };
  // Enough honest notification targets for scrolling, using a distinct signed actor.
  for (let i = 0; i < 18; i++) {
    const target = await addWish(1, `wish target ${i}`, [], fixture.note.pubkey);
    await addWish(7, '+', [
      ['e', target.id],
      ['p', fixture.note.pubkey],
    ]);
  }
  const wishEvents = async ({ kind, target, author }) => {
    wishAt++;
    if (kind === 'mentionSent') {
      const matches = () =>
        fake.published.some(
          (e) =>
            e.kind === 1 &&
            e.content.includes(`nostr:${author.npub}`) &&
            e.content.includes('wish queued note') &&
            !e.content.includes('@engine') &&
            e.tags.some((tag) => tag[0] === 'p' && tag[1] === author.pubkey),
        );
      for (let i = 0; i < 200 && !matches(); i++) await new Promise((done) => setTimeout(done, 25));
      return matches();
    }
    if (kind === 'face') {
      const picture = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='36' height='36' fill='purple'/%3E%3C/svg%3E`;
      await addWish(
        0,
        JSON.stringify({ name: 'engine-fixture', picture }),
        [],
        fixture.note.pubkey,
      );
      return picture;
    }
    if (kind === 'arrival')
      return addWish(1, `Engine wish arrival ${wishAt}`, [], fixture.note.pubkey);
    if (kind === 'reactions') {
      for (const content of ['+', '', '❤️', '-'])
        await addWish(7, content, [
          ['e', target.id],
          ['p', target.author.pubkey],
        ]);
    }
    if (kind === 'notifications') {
      const target = await addWish(1, `wish new target ${wishAt}`, [], fixture.note.pubkey);
      for (const content of ['+', '', '❤️'])
        await addWish(7, content, [
          ['e', target.id],
          ['p', fixture.note.pubkey],
        ]);
    }
  };
  await wishes({
    browser,
    base,
    real: true,
    sign: fixtureSign,
    relayUrl,
    pubkey: fixture.note.pubkey,
    fake,
    events: wishEvents,
    errors,
    check,
  });
  // The field regression intentionally publishes an owner relay edit. Restore
  // the shared fixture before independent account/bootstrap scenarios begin.
  fake.add(
    await fixtureSign({
      pubkey: fixture.note.pubkey,
      created_at: Math.floor(Date.now() / 1000) + 1,
      kind: 10002,
      tags: [['r', `${relayUrl}/owner`]],
      content: '',
    }),
  );
  await signerScenarios({
    browser,
    base,
    relayUrl,
    pubkey: fixture.note.pubkey,
    sign: fixtureSign,
    errors,
    check,
    fake,
    bunker,
  });
  const publicationsBeforeApp = fake.published.length;
  for (let i = 0; i < 100; i++) {
    fake.add(
      await fixtureSign({
        pubkey: fixture.note.pubkey,
        kind: 1,
        created_at: Math.floor(Date.UTC(2026 - Math.floor(i / 20), 10 - (i % 10), 15) / 1000),
        content: `Rail archive fixture ${i}`,
        tags: [],
      }),
    );
  }
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
  await visitorChecks({ page, browser, base, relayUrl, errors, shots, shot, check });
  await openKeyField(page);
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
  await railSmoke(page, check, shots);
  check(
    'signing in brings the ordinary layout',
    (await page.locator('.pane').count()) === 4 &&
      (await page.locator('.acct:not(.out) .av').count()) === 1 &&
      (await page.evaluate(() => typeof JSON.parse(localStorage.getItem('lkjstr:account')))) ===
        'string',
  );
  await page.locator('.view[data-kind="home"] .note .text').first().click();
  await page.locator('.th-focus').waitFor();
  check('note opens as thread');
  await page.locator('.th-focus .name').first().click();
  await page.locator('.profile').waitFor();
  check('profile opens');
  check(
    'protocol 3 exposes all profile kinds',
    (await page.locator('.pkinds [role="tab"]').allTextContents()).join(',') ===
      'Posts,Replies,Reposts,Reactions,Media',
  );
  // A second account that is only a public key: read-only is plain before anything is pressed.
  await page.locator('.acct').click();
  await page.locator('.menu button', { hasText: 'Accounts' }).click();
  await openKeyField(page);
  await page.locator(`${accounts} input`).fill(npub);
  await page.locator(`${accounts} input`).press('Enter');
  await page.locator(`${accounts} .arow`).nth(1).waitFor();
  await page.locator('.acct .ro').waitFor();
  await page.locator('.view[data-kind="compose"] .cwho .badge').first().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.note .act.off').length > 0 &&
      document.querySelectorAll('.note .act.a-reply:not(.off)').length === 0,
  );
  await writeFile(
    'tmp/read-only-state.json',
    JSON.stringify(
      {
        postDisabled: await page
          .locator('.view[data-kind="compose"] .btn.primary:visible')
          .first()
          .isDisabled(),
        off: await page.locator('.note .act.off').count(),
        liveReply: await page
          .locator('.note .act.a-reply:not(.off)')
          .evaluateAll((els) =>
            els.map((el) => ({ view: el.closest('.view')?.dataset.kind, cls: el.className })),
          ),
        faces: await page.locator('.view[data-kind="compose"] .cwho').allTextContents(),
      },
      null,
      2,
    ),
  );
  check(
    'a read-only account says so at the composer and on every action',
    (await page.locator('.view[data-kind="compose"] .btn.primary:visible').first().isDisabled()) &&
      (await page.locator('.note .act.off').count()) > 0 &&
      (await page.locator('.note .act.a-reply:not(.off)').count()) === 0,
  );
  await signerFace(page, 'public-key account switch', check);
  await page.locator('.note .act.a-heart').first().click({ force: true });
  await page.locator('.toast', { hasText: 'read-only' }).waitFor();
  check(
    'a press on a read-only action says why and publishes nothing',
    fake.published.length === publicationsBeforeApp,
  );
  // Switch back from the top bar, then remove the read-only account (it goes at once, with an Undo).
  await page.locator('.acct').click();
  await page.locator('.menu button').nth(1).click();
  await page.waitForFunction(() => !document.querySelector('.acct .ro'));
  check(
    'switching accounts changes who posts',
    (await page.locator('.note .act.off').count()) === 0 &&
      (await page.locator(`${accounts} .arow.on`).count()) === 1,
  );
  await signerFace(page, 'local-key account switch', check);
  await page.locator(`${accounts} .arow:not(.on) [data-f="remove"]`).click();
  await page.locator('.toast.undo', { hasText: 'Removed' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.arow').length === 1);
  check('a read-only account is removed at once');
  await page.locator('.tab.active[data-view^="account"] > .x').click();
  await launch('Search', 'search');
  await page.locator('.view[data-kind="search"] input').first().fill('Engine fixture');
  await page.locator('.view[data-kind="search"] input').first().press('Enter');
  await page.locator('.view[data-kind="search"] .note').first().waitFor();
  for (let n = 0; n < 200 && !fake.searches.includes('Engine'); n++) await page.waitForTimeout(25);
  check('search returns relay result', fake.searches.includes('Engine'));
  await launch('Post', 'compose');
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
  await channelScenarios({ page, launch, check, fake, shots, shot });
  await auditFixtures({ fake, sign: fixtureSign, owner: fixture.note.pubkey, note: fixture.note });
  check(
    'combined fixture retains the owner audit mute list',
    fake.stored.some(
      (e) =>
        e.kind === 10000 && e.pubkey === fixture.note.pubkey && e.tags.some((t) => t[0] === 'p'),
    ),
  );
  await auditOwner({
    browser,
    base,
    real: true,
    pubkey: fixture.note.pubkey,
    check,
    prepare: async (context) => {
      await context.exposeFunction('fixtureSign', fixtureSign);
      await installExtension(context, relayUrl, fixture.note.pubkey, errors);
    },
  });
  if (shots) {
    // Signed in, the ordinary layout as it starts, in Japanese (the language is put back afterwards).
    // Use the reader's reset: deleting storage bypasses the live WM store, whose
    // pending save can restore the old layout on pagehide with Home behind Post.
    await page.locator('.pane.cur .strip').getByTitle('Tile menu', { exact: true }).click();
    await page.locator('.menu button').getByText('Reset layout', { exact: true }).click();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
    check('Reset layout brings Home forward with real notes after Channels and Stats');
    await page.evaluate(() => localStorage.setItem('lkjstr:settings', '{"language":"ja"}'));
    await page.reload();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
    await page.waitForTimeout(1200);
    check('reset Home survives reload in Japanese', (await page.locator('.pane').count()) === 3);
    await shot(page, 'slice-signedin-1440-ja.png');
    await page.evaluate(() => localStorage.removeItem('lkjstr:settings'));
    await page.reload();
    await page.locator('.view[data-kind="home"] .note').first().waitFor();
  }
  if (shots) check('reset Home survives another reload in English');
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
  const sharedRoutes = () => fake.connections() === new Set(activePaths.values()).size;
  for (let n = 0; n < 200 && !sharedRoutes(); n++) await page.waitForTimeout(25);
  check('two app tabs share one socket per relay', sharedRoutes() && activePaths.size > 0);
  check(
    'learned owner relays survive reload and another tab bootstrap',
    [...activePaths.values()].includes('/owner') &&
      [...activePaths.values()].every((path) => path === '/owner' || path === '/'),
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
  await launch('Settings', 'settings');
  const relayField = page.getByLabel('Relay address', { exact: true });
  await relayField.fill(`${relayUrl}/visitor`);
  await relayField.press('Enter');
  await page.waitForTimeout(500);
  check(
    'signed-out relay edit is saved',
    await page.evaluate(
      (url) =>
        JSON.parse(localStorage.getItem('lkjstr:relays:') ?? '[]').some(
          (r) => r.url.replace(/\/$/, '') === url,
        ),
      `${relayUrl}/visitor`,
    ),
  );
  await page.reload();
  await page.getByLabel('Relay address', { exact: true }).waitFor();
  // The form mounts before the engine returns its persisted relay rows.
  const visitorRelay = page.locator(
    `[data-entry="set.relayList"] .rhost[title^="${relayUrl}/visitor"]`,
  );
  await visitorRelay.waitFor();
  check('signed-out relay edit survives reload', (await visitorRelay.count()) === 1);
  check('no page errors', errors.length === 0);
} catch (error) {
  checks.failure = String(error);
  if (page) await writeFile('tmp/smoke-real-dom.txt', await page.locator('body').innerText());
} finally {
  await writeReport(checks, errors, fake);
  await browser?.close();
  server.kill();
  signer.stdin.end();
  await bunker.close();
  ws.close();
  await new Promise((done) => relay.close(done));
}
if (Object.values(checks).some((v) => v !== 'ok')) {
  console.error(JSON.stringify({ checks, errors }));
  process.exitCode = 1;
} else console.log('ok smoke-real');
