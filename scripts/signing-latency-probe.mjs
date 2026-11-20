// Real production WASM, throwaway browser profile and loopback-only signing benchmark.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { clock, fixture } from './signing-latency-fixture.mjs';
import { account, gestures, openFeedViews, setup } from './signing-latency-page.mjs';

const directory = resolve(process.env.SIGN_OUTPUT ?? 'tmp/signing-latency');
const dist = resolve(process.argv[2] ?? 'dist');
const name = process.argv[3] ?? 'report';
const signer = process.env.SIGNER ?? 'local';
const kind = process.env.SIGN_MODE ?? 'note';
const count = Number(process.env.SIGN_SAMPLES ?? 220);
const views = Number(process.env.FEED_VIEWS ?? 5);
const burst = Number(process.env.FEED_BURST ?? (kind === 'reaction' ? 10 : 110));
const feedInterval = Number(process.env.FEED_INTERVAL ?? 210);
const sampleInterval = Number(process.env.SAMPLE_INTERVAL ?? (kind === 'reaction' ? 500 : 43));
const ackDelay = Number(process.env.ACK_DELAY_MS ?? 15);
const extensionDelay = Number(process.env.EXTENSION_DELAY_MS ?? 80);
const parameters = { signer, kind, count, views, burst, feedInterval, sampleInterval, ackDelay, extensionDelay };
assert.match(name, /^[a-z0-9-]+$/);
assert.ok(['local', 'protected', 'extension', 'remote'].includes(signer));
assert.ok(['note', 'reaction'].includes(kind));
assert.ok(Number.isInteger(count) && count > 0 && count <= 1000);
assert.ok(Number.isInteger(views) && views >= 0 && views <= 8);
assert.ok(Number.isInteger(burst) && burst > 0 && burst <= 400);
assert.ok([feedInterval, sampleInterval].every((n) => Number.isFinite(n) && n > 0));

await mkdir(directory, { recursive: true });
const relay = await fixture(dist, directory, signer === 'remote', ackDelay);
let browser, pump;
let pageErrors = 0;
try {
  browser = await chromium.launch({
    executablePath: process.env.LKJSTR_CHROME ?? chromium.executablePath(),
    args: ['--no-sandbox', '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  });
  const context = await setup(browser, relay, extensionDelay);
  const page = await context.newPage();
  page.on('pageerror', () => { pageErrors++; });
  const launch = clock();
  await page.goto(relay.origin);
  await page.waitForFunction(() => window.signProbe.ready());
  await page.locator('.view[data-kind="global"] .note').first().waitFor();
  const unlockMs = await account(page, signer, relay.bunker);
  await gestures(page);

  const warmCount = 800;
  if (views) {
    await openFeedViews(page, views);
    for (let i = 0; i < warmCount; i += 200) {
      relay.push(relay.events.slice(i, i + 200));
      await delay(70);
    }
    // Give the seed a chance to verify and form a retained window before the timed burst.
    await delay(1200);
  }
  let offset = views ? warmCount : 0;
  let feedComplete;
  if (views) {
    feedComplete = new Promise((done) => {
      pump = setInterval(() => {
        relay.push(relay.events.slice(offset, offset + burst));
        offset += burst;
        if (offset >= relay.events.length) {
          clearInterval(pump);
          done();
        }
      }, feedInterval);
    });
  } else if (kind === 'reaction') {
    relay.push(relay.events.slice(0, Math.max(count, 32)));
    await delay(700);
  }

  await page.evaluate(({ count, kind, sampleInterval, ids }) => {
    const probe = window.signProbe;
    window.signProbeStats = setInterval(probe.stats, 290);
    for (let i = 0; i < count; i++) setTimeout(() => {
      const what = kind === 'reaction' ? { k: 'reaction', id: ids[i], emoji: '❤️' }
        : { k: 'note', draft: { text: 'Fixture post ' + i } };
      void probe.act({ a: 'publish', what }, i);
    }, i * sampleInterval);
  }, { count, kind, sampleInterval, ids: relay.events.slice(0, count).map((event) => event.id) });
  const expected = (signer === 'protected' && kind === 'note' ? 2 : 1) + count;
  await page.waitForFunction(
    ({ kind, expected }) => window.signProbe.rows.filter((row) => row.kind === kind && row.finish).length >= expected,
    { kind, expected }, { timeout: Math.max(90000, count * sampleInterval + 45000), polling: 173 },
  );
  await feedComplete;
  // Observe feed progress after the exact same finite burst, independently of delivery completion.
  await delay(2500);
  const read = await page.evaluate(() => {
    clearInterval(window.signProbeStats);
    return window.signProbe.read();
  });
  const rows = read.rows.map(({ id, dispatch, signed, finish, extensionStart, click, ...row }) => {
    const delivery = relay.deliveries.get(id);
    return {
      ...row,
      clickToDispatch: click === undefined ? undefined : dispatch - click,
      dispatchToSigned: signed === undefined ? undefined : signed - dispatch,
      dispatchToFrame: delivery ? delivery.frame - dispatch : undefined,
      signedToRelayOk: delivery && signed !== undefined ? delivery.ack - signed : undefined,
      frameToRelayOk: delivery ? delivery.ack - delivery.frame : undefined,
      dispatchToResult: finish - dispatch,
      dispatchToExtension: extensionStart === undefined ? undefined : extensionStart - dispatch,
    };
  });
  const trials = rows.filter((r) => r.kind === kind && r.clickToDispatch === undefined && r.ok);
  const browserStats = [
    'dispatchToSigned', 'dispatchToFrame', 'signedToRelayOk', 'frameToRelayOk', 'dispatchToResult',
  ];
  const trace = read.trace.filter((r) => r.kind === (kind === 'reaction' ? 7 : 1))
    .sort((a, b) => a.enqueueMs - b.enqueueMs).slice(-count);
  const phases = {
    enqueueToReceipt: (r) => r.receivedMs - r.enqueueMs,
    receiptToStart: (r) => r.startMs - r.receivedMs,
    signer: (r) => r.responseMs === null ? undefined : r.responseMs - r.startMs,
    verification: (r) => r.signedMs === null ? undefined : r.signedMs - r.responseMs,
    enqueueToSigned: (r) => r.signedMs === null ? undefined : r.signedMs - r.enqueueMs,
    signedToPublished: (r) => r.publishedMs === null ? undefined : r.publishedMs - r.signedMs,
    enqueueToFinished: (r) => r.finishedMs - r.enqueueMs,
  };
  const stats = Object.fromEntries(browserStats.map((key) => [key, summarize(trials.map((r) => r[key]))]));
  const worker = Object.fromEntries(Object.entries(phases).map(([key, duration]) => [key, summarize(trace.map(duration))]));
  const report = {
    browser: browser.version(), parameters, coldReadyMs: read.ready - launch, unlockMs, unlockWorkMs: read.unlockWorkMs,
    sent: relay.sent(), feed: read.feedStats, window: read.window, pageErrors,
    stats, worker, rows, workerTrace: read.trace, slow: read.slow,
  };
  await writeFile(resolve(directory, name + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ parameters, sent: report.sent, feed: report.feed, worker, stats, gestures: rows.filter((r) => r.clickToDispatch !== undefined) }));
  if (process.env.ACCEPT_DELIVERY_FAILURES !== '1') assert.equal(trials.length, count);
  if (read.trace.length) assert.equal(trace.filter((r) => r.signedMs !== null).length, count);
  assert.equal(pageErrors, 0);
  if (views) {
    assert.equal(read.window.length, 800);
    assert.ok(read.window.patches > 0 && read.window.distinct && read.window.chronological);
  }
} finally {
  clearInterval(pump);
  await browser?.close();
  await relay.close();
}

function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const p = (quantile) => sorted.length === 0 ? null : Math.round(sorted[Math.ceil(sorted.length * quantile) - 1] * 10) / 10;
  return {
    n: sorted.length, p50: p(0.50), p95: p(0.95), p99: p(0.99), max: p(1),
    over300: sorted.filter((number) => number > 300).length,
  };
}
