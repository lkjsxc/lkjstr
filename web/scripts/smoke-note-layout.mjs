// Real Chromium layout-count regression. Only an owned loopback server is reachable.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { browserTmp } from './browser-tmp.ts';

const root = resolve(new URL('../..', import.meta.url).pathname);
const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const count = Number(option('rows', '120'));
const mode = option('mode', 'both');
if (!['rail', 'native', 'both'].includes(mode)) throw Error('mode must be rail, native or both');
const modes = mode === 'both' ? ['rail', 'native'] : [mode];
if (!Number.isInteger(count) || count < 2 || count > 2500)
  throw Error('rows must be between 2 and 2500');
const tmp = browserTmp(process.env.LKJSTR_TEST_TMPDIR ?? join(root, 'tmp/t'));
await mkdir(tmp, { recursive: true });
process.env.TMPDIR = tmp;
await mkdir(join(root, 'tmp'), { recursive: true });
const directory = await mkdtemp(join(root, 'tmp/note-layout-'));
const report = {
  started: new Date().toISOString(),
  loadStart: loadavg(),
  directory,
  count,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  scope:
    'Synthetic actual row-list draw with unchanged product styles; forced-layout count is the assertion, elapsed time is diagnostic only',
  cases: [],
  boundaries: [],
  errors: [],
};
let browser, server, deadline;
const sockets = new Set();
try {
  await build({
    absWorkingDir: root,
    entryPoints: ['web/scripts/note-layout-fixture.ts'],
    outfile: join(directory, 'fixture.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
  });
  const styles = await Promise.all(
    ['ui', 'notes', 'views', 'people'].map((name) =>
      readFile(join(root, `web/src/ui/${name}.css`), 'utf8'),
    ),
  );
  await writeFile(join(directory, 'fixture.css'), styles.join('\n'));
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://local').pathname;
    if (path === '/')
      return void response.end(
        '<!doctype html><link rel="stylesheet" href="/fixture.css"><script type="module" src="/fixture.js"></script>',
      );
    if (!['/fixture.js', '/fixture.css'].includes(path)) return void response.writeHead(404).end();
    response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
    response.end(await readFile(join(directory, path.slice(1))));
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  report.origin = origin;
  browser = await chromium.launch({
    // Exercise the product's width-changing scrollbar, including in headless Chromium.
    ignoreDefaultArgs: ['--hide-scrollbars'],
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    headless: true,
    args: ['--no-sandbox'],
  });
  deadline = setTimeout(() => {
    report.deadline = true;
    void browser.close();
  }, 90000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
    locale: 'en-US',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, 'WebSocket', {
      value: () => {
        throw Error('No relay access in layout fixture');
      },
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(String(error)));
  await page.goto(origin);
  await page.waitForFunction(() => Boolean(globalThis.noteLayout));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]),
    );
  for (const mode of modes)
    for (const width of count > 120 ? [720] : [720, 320]) {
      await page.evaluate(
        ({ count, width, native }) => globalThis.noteLayout.prepare(count, width, native),
        {
          count,
          width,
          native: mode === 'native',
        },
      );
      const before = await metrics();
      const timing = await page.evaluate(() => globalThis.noteLayout.draw());
      const state = await page.evaluate(() => globalThis.noteLayout.snapshot());
      const after = await metrics();
      report.cases.push({
        mode,
        width,
        count,
        ...timing,
        ...state,
        layoutCount: after.LayoutCount - before.LayoutCount,
        layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
        styleCount: after.RecalcStyleCount - before.RecalcStyleCount,
        styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
        load: loadavg(),
      });
      const repeatBefore = await metrics();
      await page.evaluate(() => globalThis.noteLayout.repeat());
      const repeatAfter = await metrics();
      report.cases.at(-1).unchangedLayoutCount = repeatAfter.LayoutCount - repeatBefore.LayoutCount;
    }
  for (const width of [720, 320]) {
    report.boundaries.push({
      width,
      ...(await page.evaluate((width) => globalThis.noteLayout.boundary(width), width)),
    });
  }
  await page.evaluate(() => globalThis.noteLayout.prepareWrapping());
  const wide = await page.locator('.fold').count();
  await page.evaluate(() => globalThis.noteLayout.resize(320));
  await page.locator('.fold').waitFor();
  const narrow = await page.locator('.fold').count();
  const shownLines = await page
    .locator('.text')
    .evaluate(
      (el) =>
        el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight),
    );
  await page.evaluate(() => globalThis.noteLayout.resize(720));
  await page.locator('.fold').waitFor({ state: 'detached' });
  await page.evaluate(() => globalThis.noteLayout.resize(320));
  await page.locator('.fold').waitFor();
  await page.locator('.fold').click();
  await page.evaluate(() => globalThis.noteLayout.repeat());
  report.wrapping = {
    wide,
    narrow,
    shownLines,
    unfolded: await page.locator('.text.open').count(),
  };
  await page.evaluate(() => globalThis.noteLayout.prepareThreshold(false));
  const oneExtraLine = await page.locator('.fold').count();
  await page.evaluate(() => globalThis.noteLayout.prepareThreshold(true));
  const reservedMedia =
    (await page.locator('.fold').count()) === 1 && (await page.locator('.mbox').isVisible());
  report.threshold = { oneExtraLine, reservedMedia };
  report.mediaRequests = await verifyMediaRequests(page, context);
  await cdp.detach();
  await context.close();
  report.complete =
    !report.errors.length &&
    wide === 0 &&
    narrow === 1 &&
    Math.abs(shownLines - 12) < 0.05 &&
    report.wrapping.unfolded === 1 &&
    oneExtraLine === 0 &&
    reservedMedia &&
    report.boundaries.every(
      (x) =>
        x.before.scrollHeight > x.before.viewportHeight &&
        x.scrollHeight <= x.viewportHeight &&
        x.clientWidth > x.before.clientWidth &&
        x.folds === 1,
    ) &&
    report.cases.every(
      (x) =>
        x.notes === count &&
        x.folds === count &&
        x.layoutCount <= 4 &&
        x.unchangedLayoutCount === 0,
    );
  if (!report.complete) process.exitCode = 1;
} catch (error) {
  report.failure = String(error?.stack ?? error).slice(0, 3000);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await browser?.close();
  for (const socket of sockets) socket.destroy();
  if (server) await new Promise((done) => server.close(done));
  report.finished = new Date().toISOString();
  report.loadEnd = loadavg();
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  if (report.complete) console.log('ok note-layout');
  else
    console.error(
      JSON.stringify({
        directory,
        failure: report.failure,
        boundaries: report.boundaries,
        cases: report.cases.map(
          ({ mode, width, layoutCount, folds, notes, unchangedLayoutCount }) => ({
            mode,
            width,
            layoutCount,
            folds,
            notes,
            unchangedLayoutCount,
          }),
        ),
      }),
    );
}

async function verifyMediaRequests(page, context) {
  const source = 'http://media-fixture.test/fail.png';
  const upgraded = 'https://media-fixture.test/fail.png';
  const blocked = [
    { type: 'image', url: 'https://media-fixture.onion/photo.png' },
    { type: 'video', url: 'https://media-fixture.i2p/movie.mp4' },
    { type: 'audio', url: 'https://127.0.0.1/song.mp3' },
  ];
  const requests = [];
  context.on('request', (request) => {
    const url = request.url();
    if (url === upgraded || url === source || blocked.some((media) => media.url === url))
      requests.push(url);
  });
  const { promise, resolve: respond } = Promise.withResolvers();
  await context.route(upgraded, async (route) => {
    await promise;
    await route.fulfill({ status: 503, headers: { 'cache-control': 'no-store' } });
  });
  try {
    const first = page.waitForRequest(upgraded, { timeout: 8000 });
    await page.evaluate(
      (media) => globalThis.noteLayout.prepareMedia(media),
      [{ type: 'image', url: source }, ...blocked],
    );
    await first;
    await page.evaluate(() => globalThis.noteLayout.remountMedia());
  } finally {
    respond();
  }
  await page.waitForFunction(() => document.querySelectorAll('.mbox.gone').length === 8);
  await page.evaluate(() => globalThis.noteLayout.remountMedia());
  assert.deepEqual(
    await page
      .locator('.mbox.gone')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    Array(2)
      .fill([source, ...blocked.map((media) => media.url)])
      .flat(),
  );
  await page.evaluate(
    (media) => globalThis.noteLayout.openMedia(media),
    [{ type: 'image', url: source }, blocked[0]],
  );
  const original = page.locator('.mstage .fstate a');
  assert.equal(await original.getAttribute('href'), source);
  await page.locator('.mbar button[aria-label="Next"]').click();
  assert.equal(await original.getAttribute('href'), blocked[0].url);
  assert.deepEqual(requests, [upgraded]);
  return requests;
}
