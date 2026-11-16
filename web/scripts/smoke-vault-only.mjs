// Focused real vault UI check. Run after build:real; no native helper or public relay is used.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { seedLayouts } from './smoke-seed.mjs';
import { vaultUiChecks } from './smoke-vault.mjs';

const root = new URL('../../', import.meta.url).pathname;
process.chdir(root);
process.env.TMPDIR ??= `${root}tmp/temp`;
process.env.XDG_CACHE_HOME ??= `${root}tmp/cache`;
process.env.XDG_CONFIG_HOME ??= `${root}tmp/config`;
process.env.XDG_DATA_HOME ??= `${root}tmp/data`;
await mkdir(process.env.TMPDIR, { recursive: true });
const fake = fakeRelay();
const relay = createServer();
const sockets = new bundle.wsServer({ server: relay });
sockets.on('connection', (socket) =>
  fake.route({
    send: (text) => socket.send(text),
    onMessage: (fn) => socket.on('message', fn),
    onClose: (fn) => socket.on('close', fn),
  }),
);
const checks = {};
const errors = [];
const check = (name, okay = true) => {
  checks[name] = okay ? 'ok' : 'FAIL';
  if (!okay) throw new Error(name);
};
let browser, server;
try {
  await new Promise((done) => relay.listen(0, '127.0.0.1', done));
  const relayUrl = `ws://127.0.0.1:${relay.address().port}`;
  server = spawn(
    process.execPath,
    ['web/scripts/serve.ts', '--port=0', `--test-relay=${relayUrl}`],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
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
  await context.route('**/*', (route) =>
    route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
  );
  await context.addInitScript((url) => {
    if (location.protocol === 'http:')
      localStorage.setItem(
        'lkjstr:relays:',
        JSON.stringify([{ url, read: true, write: true, search: true }]),
      );
  }, relayUrl);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base);
  await page.locator('.acct.out').click();
  await page.locator('.view[data-kind="account"]:visible [data-f="create"]').click();
  await page.locator('.kbox .kpassword').waitFor();
  check(
    'fresh real account opens protected backup without exposing a raw key',
    (await page.locator('.kfield').count()) === 0 &&
      (await page.locator('.kpassword [type="submit"]').isDisabled()),
  );
  await page.locator('.kbox [data-f="done"]').click();
  await vaultUiChecks(page, check);
  check('no public or local event was published by key operations', fake.published.length === 0);
  check('no page errors', errors.length === 0);
} catch (error) {
  checks.failure = String(error);
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    (async () => {
      if (server?.pid && server.exitCode === null && server.signalCode === null) {
        const closed = new Promise((done) => server.once('close', done));
        server.kill();
        await closed;
      }
    })(),
    (async () => {
      for (const socket of sockets.clients) socket.terminate();
      await new Promise((done) => sockets.close(done));
      await new Promise((done) => relay.close(done));
    })(),
  ]);
  for (const outcome of cleanup)
    if (outcome.status === 'rejected') {
      errors.push(String(outcome.reason));
      checks.cleanup = 'FAIL';
    }
  await writeFile('tmp/vault-ui-report.json', JSON.stringify({ checks, errors }, null, 2));
}
if (Object.values(checks).some((value) => value !== 'ok')) {
  console.error(JSON.stringify({ checks, errors }));
  process.exitCode = 1;
} else console.log(`ok real vault UI ${Object.keys(checks).length} checks`);
