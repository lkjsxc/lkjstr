// Production rows populate this cache; subsequent launches deliberately delay native Worker creation.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { publicCacheProbe } from './public-cache-probe.mjs';
import { openKeyField } from './smoke-seed.mjs';
import { bech32 } from './smoke-visitors.mjs';

const root = resolve(new URL('../../', import.meta.url).pathname);
process.chdir(root);
const fixturePath = process.env.LKJSTR_FIXTURE_HELPER;
if (!fixturePath) throw Error('LKJSTR_FIXTURE_HELPER must name a prebuilt owned fixture helper');
await access(fixturePath);
const output = resolve(process.env.LKJSTR_CACHE_REPORT ?? 'tmp/public-view-cache-proof');
const tempRoot = resolve(process.env.LKJSTR_TEST_TMPDIR ?? 'tmp/t');
await mkdir(output, { recursive: true });
await mkdir(tempRoot, { recursive: true });
const owned = await mkdtemp(join(tempRoot, 'pc-'));
const report = {
  started: new Date().toISOString(),
  load: loadavg(),
  checks: [],
  runs: [],
  pageErrors: [],
  externalRequests: [],
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
report.indexSha256 = hash(await readFile('dist/index.html'));
report.fixtureSha256 = hash(await readFile(fixturePath));
const check = (name, ok) => {
  report.checks.push({ name, ok: !!ok });
  if (!ok) throw Error(name);
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let signer, server, relay, socketServer, context;
let stage = 'fixture setup';
try {
  signer = spawn(fixturePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  signer.stderr.resume();
  const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
  const fixture = JSON.parse((await lines.next()).value);
  const sign = async (kind, content, tags = [], at = Math.floor(Date.now() / 1000)) => {
    signer.stdin.write(
      `${JSON.stringify({ pubkey: fixture.note.pubkey, kind, content, tags, created_at: at })}\n`,
    );
    return JSON.parse((await lines.next()).value);
  };
  const fake = fakeRelay();
  relay = createServer();
  socketServer = new bundle.wsServer({ server: relay });
  socketServer.on('connection', (socket) =>
    fake.route({
      send: (text) => socket.send(text),
      onMessage: (fn) => socket.on('message', fn),
      onClose: (fn) => socket.on('close', fn),
    }),
  );
  await new Promise((done) => relay.listen(0, '127.0.0.1', done));
  const relayUrl = `ws://127.0.0.1:${relay.address().port}`;
  server = spawn(
    process.execPath,
    ['web/scripts/serve.ts', '--port=0', `--test-relay=${relayUrl}`],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  server.stderr.resume();
  const base = await new Promise((done, fail) => {
    server.stdout.once('data', (data) => done(String(data).trim()));
    server.once('exit', (code) => fail(Error(`fixture server exited ${code}`)));
  });
  for (const event of fixture.events.filter((event) => event.kind !== 0)) fake.add(event);
  fake.add(
    await sign(
      0,
      JSON.stringify({
        name: 'Cache fixture',
        display_name: 'Cache fixture',
        picture: `${base}/icon-192.png`,
      }),
    ),
  );
  fake.add(await sign(10002, '', [['r', relayUrl]]));
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 36; i++)
    fake.add(await sign(1, `Cache fixture public note ${i}`, [], now - i));
  const launch = async (delayMs) => {
    context = await chromium.launchPersistentContext(join(owned, 'profile'), {
      executablePath:
        process.env.LKJSTR_CHROME ??
        `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
      args: ['--no-sandbox', '--disable-background-networking'],
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
    });
    await context.addInitScript(
      ({ base, relayUrl, pubkey }) => {
        if (location.origin !== base) return;
        const put = (key, value) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
        };
        put('lkjstr:migration', 'owner-audit-1');
        put('lkjstr:settings', { language: 'en', linkPreviews: false });
        put('lkjstr:layout:guest', {
          type: 'pane',
          id: 'guest',
          tabs: ['global'],
          active: 'global',
        });
        put('lkjstr:layout:main', { type: 'pane', id: 'main', tabs: ['home'], active: 'home' });
        for (const who of ['', pubkey])
          put(`lkjstr:relays:${who}`, [{ url: relayUrl, read: true, write: false, search: true }]);
      },
      { base, relayUrl, pubkey: fixture.note.pubkey },
    );
    await context.addInitScript(publicCacheProbe, { delayMs });
    context.on('request', (request) => {
      if (!request.url().startsWith(base) && report.externalRequests.length < 20)
        report.externalRequests.push(request.url());
    });
    const page = context.pages()[0] ?? (await context.newPage());
    page.on('pageerror', (error) => report.pageErrors.push(String(error)));
    page.setDefaultTimeout(15_000);
    await page.goto(base);
    return page;
  };
  const close = async () => {
    await context.close();
    context = undefined;
    for (let i = 0; i < 100 && fake.connections(); i++) await pause(20);
    check('owned page closure releases every fixture relay connection', fake.connections() === 0);
  };
  stage = 'verified cache population';
  let page = await launch(0);
  await page.locator('.acct.out').click();
  await openKeyField(page);
  const input = page.locator('.view[data-kind="account"]:visible input').first();
  await input.fill(bech32('npub', fixture.note.pubkey));
  await input.press('Enter');
  await page.waitForFunction(() => globalThis.__publicCacheProbe.firstTen !== null);
  check('fresh production engine supplies at least ten named pictured Home rows', true);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const home = '.view[data-kind="home"]:visible';
  const homeKeys = await page
    .locator(`${home} .list > .note`)
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.key));
  const openView = async (kind, selector) => {
    await page.evaluate((kind) => {
      globalThis.__publicCacheProbe.nextVisit = { kind, start: null };
    }, kind);
    await page.locator(`${home} ${selector}`).first().click();
    await page.locator(`.view[data-kind="${kind}"]:visible [data-key]`).first().waitFor();
  };
  const closeView = async (kind) => {
    await page.locator(`.tab.active[data-view^="${kind}"] .x`).first().click();
    await page.locator(home).waitFor();
  };
  for (const [kind, selector] of [
    ['thread', '.note .text'],
    ['profile', '.note .name'],
  ]) {
    await openView(kind, selector);
    await pause(300);
    await closeView(kind);
  }
  await pause(300);
  check(
    'only permitted public windows were saved',
    await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith('lkjstr:public-view:'));
      return keys.length >= 6 && keys.every((key) => key.includes('"en"'));
    }),
  );
  report.seed = await page.evaluate(() => globalThis.__publicCacheProbe);
  await close();
  const arrival = await sign(
    1,
    'Cache fixture new note waits behind the existing control',
    [],
    now + 60,
  );
  fake.add(arrival);
  for (let run = 0; run < 5; run++) {
    stage = `warm launch ${run + 1}`;
    page = await launch(1800);
    await page.waitForFunction(() => globalThis.__publicCacheProbe.firstScreen !== null);
    const early = await page.evaluate(() => globalThis.__publicCacheProbe);
    const keys = await page
      .locator(`${home} .list > .note`)
      .evaluateAll((nodes) => nodes.slice(0, 10).map((node) => node.dataset.key));
    check(
      `warm ${run + 1}: named pictured screen before native Worker creation`,
      early.firstScreen < 1800 && early.created.length === 0 && early.requested > 0,
    );
    check(
      `warm ${run + 1}: cached Home rows retain their original head`,
      JSON.stringify(keys) === JSON.stringify(homeKeys.slice(0, 10)),
    );
    if (run === 0) {
      await page.screenshot({ path: join(output, 'home-before-worker.png') });
      for (const [kind, selector] of [
        ['thread', '.note .text'],
        ['profile', '.note .name'],
      ]) {
        await openView(kind, selector);
        await closeView(kind);
      }
    }
    await page.waitForFunction(() => globalThis.__publicCacheProbe.ready !== null);
    await page.locator(`${home} .fresh:not([hidden])`).waitFor();
    const after = await page
      .locator(`${home} .list > .note`)
      .evaluateAll((nodes) => nodes.slice(0, 10).map((node) => node.dataset.key));
    check(
      `warm ${run + 1}: reconciliation and fresh arrivals never prepend`,
      JSON.stringify(after) === JSON.stringify(homeKeys.slice(0, 10)),
    );
    if (run === 4) {
      await page.locator(`${home} .fresh:not([hidden])`).click();
      await page.waitForFunction(
        (id) =>
          document
            .querySelector('.view[data-kind="home"] .list > .note')
            ?.getAttribute('data-note') === id,
        arrival.id,
      );
      check('the existing fresh control explicitly reveals the new head', true);
    }
    await pause(250);
    report.runs.push({
      run: run + 1,
      load: loadavg(),
      probe: await page.evaluate(() => globalThis.__publicCacheProbe),
    });
    await close();
  }
  check(
    'read-only browser never signs, publishes or answers AUTH',
    fake.published.length === 0 && fake.authEvents.length === 0,
  );
  check('no page errors', report.pageErrors.length === 0);
  check('no external HTTP requests', report.externalRequests.length === 0);
  check(
    'production index stayed unchanged',
    report.indexSha256 === hash(await readFile('dist/index.html')),
  );
  const times = report.runs.map((run) => run.probe.firstScreen).sort((a, b) => a - b);
  report.medianFirstScreenMs = times[Math.floor(times.length / 2)];
  report.targets = {
    firstScreenWithin300Ms: report.medianFirstScreenMs <= 300,
    repeatedViewsWithin100Ms:
      report.runs[0].probe.visits.length === 2 &&
      report.runs[0].probe.visits.every((visit) => visit.ms <= 100 && visit.workers === 0),
  };
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { stage, message: String(error) };
  process.exitCode = 1;
} finally {
  await context?.close();
  for (const socket of socketServer?.clients ?? []) socket.terminate();
  socketServer?.close();
  if (relay?.listening) await new Promise((done) => relay.close(done));
  for (const child of [server, signer])
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise((done) => child.once('exit', done)), pause(1000)]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  await rm(owned, { recursive: true, force: true });
  report.finished = new Date().toISOString();
  report.loadAfter = loadavg();
  await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      medianFirstScreenMs: report.medianFirstScreenMs,
      failure: report.failure,
      report: join(output, 'report.json'),
    }),
  );
}
