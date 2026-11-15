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
import { fakeMediaSet } from '../../scripts/browser-media.mjs';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { auditFixtures } from './audit-fixtures.mjs';
import { auditOwner } from './audit-owner.mjs';
import { channelScenarios } from './smoke-channels.mjs';
import { realReaderChecks } from './smoke-reader.mjs';
import { finishAccounts, reviewSettings, seedRailArchive } from './smoke-real-finish.mjs';
import { openKeyField, seedLayouts } from './smoke-seed.mjs';
import { writeReport } from './smoke-signer-support.mjs';
import { signerScenarios } from './smoke-signers.mjs';
import { railSmoke } from './smoke-time-rail.ts';
import { uploadScenarios } from './smoke-uploads.mjs';
import { accounts, installExtension, npub, visitorChecks } from './smoke-visitors.mjs';

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
// The archive/audit can fill one 1000-event store; reader arrivals get their own bounded fixture.
const readerFake = fakeRelay();
const bunker = await fakeBunker();
const media = await fakeMediaSet();
for (const event of [fixture.note, ...fixture.events]) {
  fake.add(event);
  readerFake.add(event);
}
let signing = Promise.resolve();
const relay = createServer();
const ws = new bundle.wsServer({ server: relay });
const activePaths = new Map(); // bound by the engine's eight relay connections
ws.on('connection', (socket, req) => {
  if (req.url === '/bunker' || req.url === '/bunker-secret')
    return bunker.route(socket, req.url === '/bunker-secret');
  activePaths.set(socket, req.url);
  socket.on('close', () => activePaths.delete(socket));
  (req.url === '/reader' ? readerFake : fake).route({
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
  [
    'web/scripts/serve.ts',
    '--port=0',
    '--test-previews',
    `--test-relay=${relayUrl}`,
    `--test-media=${Object.values(media.origins).join(',')}`,
  ],
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
    args: ['--no-sandbox', '--disable-background-networking', '--ignore-certificate-errors'],
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
  const scenario = {
    browser,
    base,
    relayUrl,
    pubkey: fixture.note.pubkey,
    sign: fixtureSign,
    errors,
    check,
    fake,
    bunker,
  };
  await signerScenarios(scenario);
  await uploadScenarios({ ...scenario, media });
  const publicationsBeforeApp = fake.published.length;
  await seedRailArchive({ fake, sign: fixtureSign, pubkey: fixture.note.pubkey });
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
  // Account badges update before the replacement list windows arrive.
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.note .act.off').length > 0 &&
      document.querySelectorAll('.note .act.a-reply:not(.off)').length === 0,
  );
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
  await page.locator(`${accounts} .arow:not(.on) [data-f="remove"]`).click();
  await page.locator('.toast.undo').waitFor();
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
  const other = await reviewSettings({
    page,
    ctx,
    base,
    fake,
    activePaths,
    check,
    launch,
    shots,
    shot,
  });
  await finishAccounts({ page, other, relayUrl, check, launch });
  await realReaderChecks({
    browser,
    base,
    relayUrl: `${relayUrl}/reader`,
    fake: readerFake,
    fixture,
    fixtureSign,
    check,
    onReader: (reader) => (page = reader),
  });
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
  await media.close();
  ws.close();
  await new Promise((done) => relay.close(done));
}
if (Object.values(checks).some((v) => v !== 'ok')) {
  console.error(JSON.stringify({ checks, errors }));
  process.exitCode = 1;
} else console.log('ok smoke-real');
