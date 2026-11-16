// Focused real private-message UI check. It needs an already-built real dist and never invokes Cargo.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { archiveDisk } from '../../scripts/engine-draft-client.mjs';
import { dmUiScenario, privateMarkers } from './smoke-dm-ui.mjs';
import { installDmWire } from './smoke-dm-wire.mjs';
import { seedLayouts } from './smoke-seed.mjs';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright-core'),
  bundle = require('playwright-core/lib/utilsBundle');
const root = new URL('../../', import.meta.url).pathname;
process.chdir(root);
process.env.TMPDIR ??= '/home/coder/workspace/lkjstr-stream-20261116/tmp/n';
process.env.XDG_CACHE_HOME ??= `${root}tmp/cache`;
process.env.XDG_CONFIG_HOME ??= `${root}tmp/config`;
process.env.XDG_DATA_HOME ??= `${root}tmp/data`;
await mkdir(process.env.TMPDIR, { recursive: true });
const fake = fakeRelay(),
  relay = createServer(),
  sockets = new bundle.wsServer({ server: relay });
const buffered = []; // <=4 wrapper frames from one deliberate fixture send
let holding = false;
sockets.on('connection', (socket) =>
  fake.route({
    send: (text) => socket.send(text),
    onMessage: (fn) =>
      socket.on('message', (raw) => {
        const message = JSON.parse(String(raw));
        if (holding && message[0] === 'EVENT' && message[1]?.kind === 1059 && buffered.length < 4)
          buffered.push(() => {
            if (socket.readyState === 1) fn(raw);
          });
        else fn(raw);
      }),
    onClose: (fn) => socket.on('close', fn),
  }),
);
const checks = {},
  errors = [];
const check = (name, okay = true) => {
  checks[name] = okay ? 'ok' : 'FAIL';
  if (!okay) throw new Error(name);
};
let browser, server, page;
try {
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
    server.once('error', fail);
    server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
  browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    args: ['--no-sandbox', '--disable-background-networking'],
  });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    locale: 'en-US',
  });
  await seedLayouts(context);
  await installDmWire(context, relayUrl);
  await context.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.name));
  await page.goto(base);
  await page.waitForFunction(() => !!window.dmUi?.ready);
  const ready = await page.evaluate(() => window.dmUi.ready);
  check(
    'the actual UI uses the real protocol8 engine',
    ready.version >= 8 && ready.engine !== 'mock',
  );
  await dmUiScenario({
    page,
    relayUrl,
    fake,
    check,
    hold: () => {
      holding = true;
    },
    release: () => {
      holding = false;
      for (const next of buffered.splice(0)) next();
    },
  });
  const accounts = await page.evaluate(() =>
    window.dmUi.accounts.accounts.map((a) => a.author.pubkey),
  );
  const disk = await archiveDisk(page, accounts, privateMarkers);
  check('private UI bodies are absent from durable public storage', disk.privateTextAbsent);
  check('private UI failures are absent', errors.length === 0);
} catch (error) {
  checks.failure = String(error);
  if (page) {
    await page
      .screenshot({ path: 'tmp/dm-ui-real-failure.png', fullPage: true })
      .catch(() => undefined);
    const detail = await page
      .evaluate(() => ({
        accounts: window.dmUi?.accounts,
        trace: window.dmUi?.events,
        inboxProbe: window.dmUi?.inboxProbe,
        views: [...document.querySelectorAll('.view')].map((el) => ({
          kind: el.dataset.kind,
          visible: !!el.getClientRects().length,
          text: el.textContent?.slice(0, 500),
        })),
      }))
      .catch(() => undefined);
    await writeFile('tmp/dm-ui-real-failure.json', JSON.stringify(detail, null, 2));
  }
} finally {
  buffered.length = 0;
  const cleanup = await Promise.allSettled([
    browser?.close(),
    (async () => {
      if (server && server.exitCode === null && server.signalCode === null) {
        const closed = new Promise((done) => server.once('close', done));
        server.kill();
        await closed;
      }
    })(),
    (async () => {
      for (const socket of sockets.clients) socket.terminate();
      await new Promise((done) => sockets.close(done));
      if (relay.listening) await new Promise((done) => relay.close(done));
    })(),
  ]);
  for (const result of cleanup)
    if (result.status === 'rejected') {
      checks.cleanup = 'FAIL';
      errors.push(String(result.reason));
    }
  await writeFile('tmp/dm-ui-real-report.json', JSON.stringify({ checks, errors }, null, 2));
}
if (Object.values(checks).some((value) => value !== 'ok')) {
  console.error(JSON.stringify({ checks, errors }));
  process.exitCode = 1;
} else console.log(`ok real private UI ${Object.keys(checks).length} checks`);
