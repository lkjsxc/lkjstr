// Finite loopback proof: wire receipt, source DOM membership and time boundaries stay distinct.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { loadavg, homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright-core';
import { observeRelease } from './real-hour-observe.mjs';
import { observeDom, observationFor } from './real-hour-dom.mjs';
const account = '9'.repeat(64), focus = '8'.repeat(64);
await mkdir('tmp', { recursive: true });
const directory = await mkdtemp(resolve('tmp/dom-evidence-proof-'));
const profile = join(directory, 'profile');
const report = { startedUtc: new Date().toISOString(), loadBefore: loadavg(), directory, checks: [], errors: [] };
report.executedFunctionHashes = Object.fromEntries(Object.entries({ observeRelease, observeDom, observationFor })
  .map(([name, fn]) => [name, createHash('sha256').update(fn.toString()).digest('hex')]));
const started = performance.now();
const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  response.end('<!doctype html><title>Local DOM evidence fixture</title>');
});
let context, origin, external = 0;
const check = name => report.checks.push(name);
try {
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  origin = 'http://127.0.0.1:' + server.address().port;
  report.origin = origin;
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.LKJSTR_CHROME ?? join(homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'),
    headless: true, args: ['--no-sandbox', '--disable-background-networking'], serviceWorkers: 'block',
    env: { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), XDG_CONFIG_HOME: join(directory, 'config'),
      XDG_DATA_HOME: join(directory, 'data') },
  });
  context.setDefaultTimeout(10000);
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    external++; return route.abort();
  });
  await context.addInitScript({ content: 'globalThis.__realHourExpectedAccount=' + JSON.stringify(account)
    + ';(' + observeRelease.toString() + ')();(' + observeDom.toString() + ')({limit:4});' });
  const fresh = async (source = 'home') => {
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error).slice(0, 300)));
    await page.goto(origin);
    await page.evaluate(({ account, source, focus }) => {
      globalThis.proofPort = new MessageChannel();
      proofPort.port2.onmessage = () => {};
      proofPort.port1.onmessage = () => { globalThis.proofReceived?.(); globalThis.proofReceived = undefined; };
      globalThis.proofWire = message => new Promise(ok => { globalThis.proofReceived = ok; proofPort.port2.postMessage(message); });
      globalThis.proofOpen = (source, sub = source, selected = account, id = focus) =>
        proofPort.port1.postMessage({ t: 'open', sub, query: { source, account: selected, ...(source === 'thread' ? { id } : {}) } });
      globalThis.proofMount = (kind, tab = kind) => {
        const body = document.createElement('section'); body.className = 'body own'; body.dataset.view = tab;
        const view = document.createElement('section'); view.className = 'view feed'; view.dataset.kind = kind;
        const list = document.createElement('div'); list.className = 'list';
        view.append(list); body.append(view); document.body.append(body); return list;
      };
      globalThis.proofNote = id => {
        const note = document.createElement('article'); note.className = 'note'; note.dataset.note = id; return note;
      };
      proofOpen(source);
      globalThis.proofList = proofMount(source, source === 'thread' ? 'thread:' + focus : source);
      globalThis.proofId = character => character.repeat(64);
    }, { account, source, focus });
    return page;
  };
  const snapshot = page => page.evaluate(() => ({
    at: Date.now(), wire: globalThis.__realHour.seen, wireFirst: globalThis.__realHour.wireFirst,
    dom: globalThis.__realHourDomSnapshot(true),
  }));
  const page = await fresh();
  let value = await snapshot(page);
  assert.equal(value.dom.installed, true); assert.equal(value.dom.sources.home.scope.account, account);
  check('one mounted Home and one matching-account query establish an explicit source scope');
  await page.evaluate(async () => {
    await proofWire({ t: 'rows', sub: 'home', rows: [{ kind: 'note', id: proofId('a'), key: proofId('a') }] });
  });
  value = await snapshot(page);
  assert.deepEqual(value.wire.home, ['a'.repeat(64)]); assert.equal(value.dom.sources.home.count, 0);
  assert.equal(value.dom.first.home['a'.repeat(64)], undefined);
  report.wireOnlyCounterexample = { wireRows: value.wire.home.length, domRows: value.dom.sources.home.count,
    meaning: 'The former wire-as-displayed comparison would count this undrawn row.' };
  check('a real MessagePort row can be received while Home has no matching DOM member');
  await page.evaluate(() => {
    const note = proofNote(proofId('b')), quote = document.createElement('aside');
    quote.className = 'quote'; quote.append(proofNote(proofId('c'))); note.append(quote); proofList.append(note);
    proofMount('global').append(proofNote(proofId('d')));
    const detached = document.createDocumentFragment(); detached.append(proofNote(proofId('f')));
    globalThis.proofDetached = detached;
  });
  value = await snapshot(page);
  assert.deepEqual(Object.keys(value.dom.first.home), ['b'.repeat(64)]);
  const first = value.dom.first.home['b'.repeat(64)];
  check('only a connected direct Home row counts; nested quotes, another tile and detached rows do not');
  await page.waitForFunction(at => Date.now() > at, first);
  await page.evaluate(() => {
    const note = proofList.firstElementChild; note.remove(); proofList.append(note);
  });
  value = await snapshot(page); assert.equal(value.dom.first.home['b'.repeat(64)], first);
  check('removal and reinsertion preserve the first observed membership time');
  await page.evaluate(async () => {
    await proofWire({ t: 'patch', sub: 'home', ops: [{ op: 'insert', before: null,
      rows: [{ kind: 'note', id: proofId('e'), key: proofId('e') }] }] });
  });
  const cutoff = Date.now();
  await page.waitForFunction(at => Date.now() > at, cutoff);
  await page.evaluate(() => proofList.append(proofNote(proofId('e'))));
  value = await snapshot(page);
  const timing = observationFor(value, 'home', 'e'.repeat(64), cutoff);
  assert.equal(timing.wireByCutoff, true); assert.equal(timing.domByCutoff, false); assert.equal(timing.domDuringGrace, true);
  report.cutoff = { cutoff, ...timing };
  check('pre-cutoff wire receipt and post-cutoff DOM membership remain separate');
  await page.evaluate(() => {
    proofList.append(proofNote(proofId('f')), proofNote(proofId('0')), proofNote(proofId('1')));
  });
  value = await snapshot(page);
  assert.equal(value.dom.sources.home.count, 4); assert.equal(value.dom.sources.home.saturated, true);
  assert.ok(value.dom.sources.home.dropped > 0); assert.equal(Object.keys(value.dom.first.home).length, 4);
  const dropped = value.dom.sources.home.dropped;
  await page.evaluate(() => proofList.append(proofList.firstElementChild));
  value = await snapshot(page); assert.equal(value.dom.sources.home.dropped, dropped);
  report.saturated = value.dom.sources.home;
  check('the identity cap stays bounded and records saturation without recounting retained IDs');
  const ambiguous = await fresh();
  await ambiguous.evaluate(() => { proofMount('home'); proofList.append(proofNote(proofId('2'))); });
  value = await snapshot(ambiguous);
  assert.ok(value.dom.sources.home.unknown.includes('multiple-mounted-source-views'));
  assert.equal(value.dom.sources.home.count, 0);
  await ambiguous.evaluate(() => document.querySelectorAll('.body.own[data-view="home"]')[1].remove());
  value = await snapshot(ambiguous);
  assert.ok(value.dom.sources.home.unknown.includes('multiple-mounted-source-views'));
  check('multiple Home tiles refuse attribution and the loss remains sticky after ambiguity ends');
  const queries = await fresh();
  await queries.evaluate(() => { proofOpen('home', 'other-home'); proofList.append(proofNote(proofId('3'))); });
  value = await snapshot(queries);
  assert.equal(value.dom.sources.home.count, 0);
  assert.ok(value.dom.sources.home.unknown.includes('unsupported-account-or-query-attribution'));
  check('two open Home queries cannot be pooled into one complete DOM source');
  const switched = await fresh();
  await switched.evaluate(() => { proofOpen('home', 'home', proofId('7')); proofList.append(proofNote(proofId('4'))); });
  value = await snapshot(switched);
  assert.equal(value.dom.sources.home.count, 0);
  assert.ok(value.dom.sources.home.unknown.includes('unsupported-account-or-query-attribution'));
  check('a changed query account cannot be attributed to the fixed public reader');
  const thread = await fresh('thread');
  await thread.evaluate(() => proofList.append(proofNote(proofId('5'))));
  value = await snapshot(thread);
  assert.equal(value.dom.sources.thread.count, 1); assert.equal(value.dom.sources.home.count, 0);
  assert.equal(value.dom.sources.thread.scope.focus, focus);
  await thread.evaluate(() => { proofOpen('thread', 'thread', __realHourExpectedAccount, proofId('6')); proofList.append(proofNote(proofId('7'))); });
  value = await snapshot(thread);
  assert.equal(value.dom.sources.thread.count, 1);
  assert.ok(value.dom.sources.thread.unknown.includes('source-scope-changed'));
  check('thread DOM evidence has its own focus and never satisfies Home membership');
  await thread.evaluate(() => { __realHourDomStop(); proofList.append(proofNote(proofId('a'))); });
  value = await snapshot(thread);
  assert.equal(value.dom.stopped, true); assert.equal(value.dom.sources.thread.count, 1);
  assert.ok(value.dom.sources.thread.unknown.includes('observer-stopped'));
  check('disconnecting the witness stops collection and invalidates completeness');
  assert.equal(external, 0); assert.deepEqual(report.errors, []);
  check('all browser traffic stays on the owned loopback origin with no page errors');
} catch (error) {
  report.failure = String(error.stack ?? error); process.exitCode = 1;
} finally {
  try { await context?.close(); } finally {
    server.closeAllConnections(); await new Promise(ok => server.close(ok));
    await Promise.all(['profile', 'cache', 'config', 'data'].map(name => rm(join(directory, name), { recursive: true, force: true })));
  }
  report.elapsedSeconds = (performance.now() - started) / 1000;
  report.loadAfter = loadavg(); report.finishedUtc = new Date().toISOString(); report.cleanup = true;
  report.externalRequests = external; report.sourceHashes = {};
  for (const name of ['real-hour-dom.mjs', 'real-hour-observe.mjs', 'real-hour-dom-proof.mjs'])
    report.sourceHashes[name] = createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex');
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ directory, checks: report.checks.length, seconds: report.elapsedSeconds,
    loadBefore: report.loadBefore, loadAfter: report.loadAfter, cleanup: report.cleanup, failure: report.failure }));
}
