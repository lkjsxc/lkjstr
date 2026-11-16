// Finite native-helper + loopback-control + actual Chromium DOM-instrumentation proof.
// This proves measurement semantics; it does not claim a production app or public-hour run.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile, copyFile, chmod } from 'node:fs/promises';
import { homedir, loadavg } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { historicalFixture } from './real-hour-history-fixture.mjs';
import { preflightHistorical } from './real-hour-history-preflight.mjs';
import { nativeEligibility } from './real-hour-audit.mjs';
import { controlBudget } from './real-hour-budget.mjs';
import { queryRelay } from './real-hour-public.mjs';
import { matches } from './real-hour-coverage.mjs';
import { observeRelease } from './real-hour-observe.mjs';
import { observeDom } from './real-hour-dom.mjs';
import { historicalDom, captureHistorical, mountHistoricalThread } from './real-hour-history-dom.mjs';
await mkdir('tmp', { recursive: true });
const directory = await mkdtemp(resolve('tmp/historical-witness-proof-'));
const report = { startedAt: new Date().toISOString(), loadBefore: loadavg(), directory,
  checks: [], errors: [], requests: [], externalRequests: 0, forbiddenFrames: 0 };
const check = name => report.checks.push(name);
const sockets = new Set();
let server, ws, context, fixture, temporary;
try {
  const bin = join(directory, 'bin'); await mkdir(bin);
  for (const [name, variable] of [['engine-fixtures', 'LKJSTR_ENGINE_FIXTURE_BIN'], ['engine-public-verify', 'LKJSTR_REAL_VERIFY']]) {
    const from = process.env[variable] ?? join(process.env.CARGO_TARGET_DIR ?? 'target', 'debug/examples', name);
    const destination = join(bin, name); await copyFile(from, destination); await chmod(destination, 0o555); process.env[variable] = destination;
  }
  fixture = await historicalFixture();
  report.helperHash = createHash('sha256').update(await readFile(fixture.bin)).digest('hex');
  report.verifyHash = createHash('sha256').update(await readFile(process.env.LKJSTR_REAL_VERIFY ?? 'target/debug/examples/engine-public-verify')).digest('hex');
  report.functionHashes = Object.fromEntries(Object.entries({ observeRelease, observeDom, historicalDom }).map(([name, fn]) =>
    [name, createHash('sha256').update(fn.toString()).digest('hex')]));
  await writeFile(join(directory, 'signed-fixtures.json'), JSON.stringify(fixture.events));
  const queries = { notifications: { query: { source: 'notifications', account: fixture.owner }, ...fixture.span },
    thread: { query: { source: 'thread', account: fixture.owner, id: fixture.focus.id }, ...fixture.span } };
  const native = nativeEligibility(fixture.events, [fixture.follow, fixture.mute], queries, { relationships: true, ordered: true });
  report.native = native;
  for (const note of [fixture.first, fixture.second, fixture.mention]) assert.ok(native.eligibility.notifications.eligible.includes(note.id));
  for (const note of [fixture.own, fixture.hidden, fixture.outside, fixture.invalid]) assert.ok(!native.eligibility.notifications.eligible.includes(note.id));
  assert.ok(native.rejected > 0); check('native text eligibility excludes own, muted, outside-span and invalid events');
  assert.ok(native.eligibility.thread.eligible.includes(fixture.first.id));
  assert.ok(native.eligibility.thread.eligible.includes(fixture.second.id));
  assert.ok(!native.eligibility.thread.eligible.includes(fixture.quote.id));
  assert.equal(native.relationships.find(item => item.id === fixture.first.id).parent, fixture.focus.id);
  check('native direct replies are positive while a focus quote is not a thread reply');
  server = createServer((request, response) => response.writeHead(200, { 'Content-Type': 'text/html' })
    .end('<!doctype html><title>Owned historical evidence fixture</title>'));
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const relays = ['a', 'b', 'c'].map(path => origin.replace('http:', 'ws:') + '/' + path);
  ws = new bundle.wsServer({ server });
  ws.on('connection', socket => socket.on('message', raw => {
    let message; try { message = JSON.parse(String(raw)); } catch { report.errors.push('malformed owned control frame'); socket.close(); return; }
    if (message[0] === 'CLOSE') return;
    if (message[0] !== 'REQ') { report.forbiddenFrames++; socket.close(); return; }
    if (report.requests.length >= 100) { report.errors.push('owned fixture request cap'); socket.close(); return; }
    report.requests.push({ at: Date.now(), filters: message.slice(2) });
    const selected = new Map();
    for (const filter of message.slice(2)) for (const event of fixture.events.filter(event => matches(event, filter))
      .sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit ?? 200)) selected.set(event.id, event);
    for (const event of selected.values()) socket.send(JSON.stringify(['EVENT', message[1], event]));
    socket.send(JSON.stringify(['EOSE', message[1]]));
  }));
  const availability = await preflightHistorical({ relays, requested: fixture.owner });
  report.preflight = availability.report;
  assert.equal(availability.report.selection.informative, true);
  assert.equal(availability.account.pubkey, fixture.owner);
  assert.equal(availability.report.selection.thread.focus, fixture.focus.id);
  assert.ok(!availability.report.selection.notifications.ids.includes(fixture.reaction.id));
  assert.equal(availability.report.budget.activeRequests, 0);
  check('owned independent preflight selects positive native witnesses before any browser launch');
  const tiny = controlBudget({ bytes: 50 });
  const capped = await queryRelay(relays[0], [{ kinds: [1], limit: 1 }], 1000, { budget: tiny });
  assert.equal(capped.status, 'budget'); assert.equal(tiny.snapshot().reason, 'aggregate-byte-limit');
  assert.equal(tiny.snapshot().activeRequests, 0); check('real control socket closes on aggregate byte exhaustion');
  const temporaryBase = process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp');
  await mkdir(temporaryBase, { recursive: true }); temporary = await mkdtemp(join(temporaryBase, 'hw-'));
  context = await chromium.launchPersistentContext(join(directory, 'profile'), {
    executablePath: process.env.LKJSTR_CHROME ?? join(homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'),
    headless: true, serviceWorkers: 'block', args: ['--no-sandbox', '--disable-background-networking'],
    env: { ...process.env, TMPDIR: temporary, XDG_CACHE_HOME: join(directory, 'cache'), XDG_CONFIG_HOME: join(directory, 'config'), XDG_DATA_HOME: join(directory, 'data') },
  });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    report.externalRequests++; return route.abort();
  });
  await context.addInitScript({ content: 'globalThis.__realHourExpectedAccount=' + JSON.stringify(fixture.owner)
    + ';(' + observeRelease.toString() + ')();(' + observeDom.toString() + ')();' });
  const fresh = async source => {
    const page = await context.newPage(); page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(origin);
    await page.evaluate(({ source, account, focus }) => {
      globalThis.fixturePort = new MessageChannel(); fixturePort.port2.onmessage = () => {};
      fixturePort.port1.onmessage = () => { globalThis.fixtureReceived?.(); globalThis.fixtureReceived = undefined; };
      globalThis.sendRows = rows => new Promise(ok => { globalThis.fixtureReceived = ok; fixturePort.port2.postMessage({ t: 'rows', sub: source, rows, atTop: true, atBottom: true }); });
      fixturePort.port1.postMessage({ t: 'open', sub: source, query: { source, account, ...(source === 'thread' ? { id: focus } : {}) } });
      fixturePort.port1.postMessage({ t: 'window', sub: source, anchor: 'top', before: 0, after: 60 });
      const body = document.createElement('section'); body.className = 'body own'; body.dataset.view = source === 'thread' ? 'thread:' + focus : source;
      const view = document.createElement('section'); view.className = 'view feed'; view.dataset.kind = source; view.style.minHeight = '200px';
      const list = document.createElement('div'); list.className = 'list'; view.append(list); body.append(view); document.body.append(body);
      globalThis.fixtureList = list;
      globalThis.fixtureNote = id => { const note = document.createElement('article'); note.className = 'note'; note.dataset.note = id; note.textContent = 'owned fixture'; return note; };
    }, { source, account: fixture.owner, focus: fixture.focus.id });
    return page;
  };
  const page = await fresh('notifications'), scope = { source: 'notifications', account: fixture.owner };
  await page.evaluate(id => sendRows([{ kind: 'notification', key: id, type: 'mention', note: { kind: 'note', id, key: id } }]), fixture.mention.id);
  assert.deepEqual((await captureHistorical(page, scope)).ids, []); check('wire-only notification cannot count as historical DOM membership');
  await page.evaluate(({ first, second, quote, other, reaction }) => {
    const a = fixtureNote(first), b = fixtureNote(second); a.append(fixtureNote(quote)); fixtureList.append(a, b);
    const group = document.createElement('div'); group.className = 'notif'; group.dataset.key = reaction; fixtureList.append(group);
    const foreign = document.createElement('div'); foreign.className = 'view feed'; foreign.dataset.kind = 'home'; foreign.append(fixtureNote(other)); document.body.append(foreign);
  }, { first: fixture.first.id, second: fixture.second.id, quote: fixture.quote.id, other: fixture.mention.id, reaction: fixture.reaction.id });
  let observed = await captureHistorical(page, scope);
  assert.deepEqual(observed.ids, [fixture.first.id, fixture.second.id]); assert.equal(observed.groupRowsExcluded, 1);
  check('positive top-level text witnesses exclude nested quotes, another tile and grouped constituents');
  await page.evaluate(() => { fixturePort.port1.postMessage({ t: 'open', sub: 'notifications', query: { source: 'notifications', account: 'f'.repeat(64) } }); });
  observed = await captureHistorical(page, scope); assert.ok(observed.unknown.length); assert.deepEqual(observed.ids, []);
  check('changed account attribution cannot count previously mounted notes');
  const thread = await fresh('thread');
  await thread.evaluate(({ first, second, quote }) => { const a = fixtureNote(first); a.append(fixtureNote(quote)); fixtureList.append(a, fixtureNote(second)); },
    { first: fixture.first.id, second: fixture.second.id, quote: fixture.quote.id });
  observed = await captureHistorical(thread, { source: 'thread', account: fixture.owner, focus: fixture.focus.id });
  assert.deepEqual(observed.ids, [fixture.first.id, fixture.second.id]); check('native eligible thread replies have separate focus-scoped DOM witnesses');
  const home = await fresh('home');
  await home.evaluate(id => {
    const note = fixtureNote(id); note.textContent = '';
    const row = document.createElement('div'); row.className = 'nrow'; const main = document.createElement('div'); main.className = 'nmain';
    const head = document.createElement('div'); head.className = 'nhead'; const time = document.createElement('time'); time.textContent = 'owned time';
    time.onclick = () => { globalThis.clickedFocus = id; }; head.append(time); main.append(head); row.append(main); note.append(row); fixtureList.append(note);
  }, fixture.focus.id);
  const mounted = await mountHistoricalThread({ page: home, account: fixture.owner, focus: fixture.focus.id, deadlineAt: Date.now() + 1000 });
  assert.equal(mounted.clicked, true); assert.equal(await home.evaluate(() => clickedFocus), fixture.focus.id);
  check('selected focus uses only its existing direct-note header action');
  const expired = await home.evaluate(historicalDom, { source: 'home', account: fixture.owner, expiresAt: Date.now() - 1 });
  assert.deepEqual(expired.ids, []); assert.ok(expired.unknown.length); check('expired browser observation cannot reuse existing DOM membership');
  assert.equal(report.externalRequests, 0); assert.equal(report.forbiddenFrames, 0); assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) { report.failure = String(error?.stack ?? error); process.exitCode = 1; }
finally {
  await context?.close().catch(error => report.errors.push('browser cleanup: ' + String(error)));
  if (ws) { for (const socket of ws.clients) socket.terminate(); await new Promise(ok => ws.close(ok)); }
  for (const socket of sockets) socket.destroy();
  if (server?.listening) await new Promise(ok => server.close(ok));
  await Promise.all(['profile', 'cache', 'config', 'data'].map(name => rm(join(directory, name), { recursive: true, force: true })));
  if (temporary) await rm(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString(); report.loadAfter = loadavg();
  report.cleanup = { browser: !context || context.pages().length === 0, server: !server?.listening, sockets: sockets.size,
    ownedDataRemoved: true, temporaryRemoved: true };
  report.ok &&= report.errors.length === 0 && report.cleanup.browser && report.cleanup.server && report.cleanup.sockets === 0;
  if (!report.ok) process.exitCode = 1;
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ directory, ok: report.ok ?? false, checks: report.checks.length, failure: report.failure }));
}
