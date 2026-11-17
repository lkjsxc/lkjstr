// Opt-in real encrypted-message cache proof, with only fresh keys and an owned loopback relay.
import { cp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { loadavg } from 'node:os';
import { chromium } from 'playwright-core';
import { ownedDirectory } from './real-hour-owned.mjs';
import { buildIdentity } from './real-hour-browser.mjs';
import { archiveDisk } from './engine-draft-client.mjs';
import { installDmWire } from '../web/scripts/smoke-dm-wire.mjs';
import { privateFixture } from './cache-repeat-private-fixture.mjs';
import { installPrivateCacheProbe, waitPrivatePaint } from './cache-repeat-private-probe.mjs';
import { privateMarker, privateAct, setupPrivateReader, openPrivateConversation,
  closePrivateConversation, unlockPrivateReader, privateLocked, privateKeysProtected } from './cache-repeat-private-setup.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const args = {};
for (const value of process.argv.slice(2)) {
  const match = /^--(build|output)=(.+)$/.exec(value);
  if (!match || args[match[1]]) throw Error('Use unique --build= and --output= options');
  args[match[1]] = match[2];
}
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const directory = await ownedDirectory(root, args.output ?? 'tmp/cache-private-' + stamp, true);
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
process.env.TMPDIR = resolve(common, '..', 'tmp/t'); await mkdir(process.env.TMPDIR, { recursive: true });
for (const [variable, child] of [['XDG_CACHE_HOME', 'cache'], ['XDG_CONFIG_HOME', 'config'], ['XDG_DATA_HOME', 'data']])
  process.env[variable] = directory + '/' + child;
const report = { schema: 'lkjstr-private-cache-proof-1', ownership: { kind: 'lkjstr-private-cache', id: randomUUID(),
  root: await realpath(root), directory }, started: new Date().toISOString(), initialLoadAverage: loadavg(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  checks: {}, visits: [], errors: [], scope: [
    'Synthetic encrypted messages with two freshly generated browser-owned keys and one owned loopback relay.',
    'Message and inbox body timing only; names, pictures, counts and unrelated private views are not certified.',
    'Cache proofs deliberately withhold relay EVENT replay and do not claim natural traffic-reduction ratios.',
    'After-unlock timing excludes all work before acknowledgement, including any completed archive restore/decryption.',
    'This finite private proof is separate from the two public usage hours.'] };
let fixture, context, page, stage = 'prepare', stopped = false;
const save = async () => {
  await writeFile(directory + '/report.json', JSON.stringify(report, null, 2) + '\n');
  const lines = ['# Private cache proof', '', 'Started: ' + report.started + '.', 'Complete: ' + Boolean(report.complete) + '.', '',
    '| Visit | Painted ms | Body present | Within 100 ms | Relay events |', '| --- | --- | --- | --- | --- |'];
  for (const row of report.visits) lines.push('| ' + [row.name, Number.isFinite(row.dom?.paintedMs) ? row.dom.paintedMs.toFixed(1) : 'unavailable',
    row.dom?.bodyPresent ?? false, row.cacheConfirmedWithin100, row.traffic.events].join(' | ') + ' |');
  lines.push('', '## Limits', '', ...report.scope.map(value => '- ' + value));
  await writeFile(directory + '/report.md', lines.join('\n') + '\n');
};
const check = (name, okay) => { report.checks[name] = Boolean(okay); if (!okay) throw Error('Owned fixture check failed'); };
const stop = () => { stopped = true; report.interrupted = true; void context?.close().catch(() => {}); };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
const launch = async profile => {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.LKJSTR_CHROME ?? process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    headless: true, viewport: { width: 1024, height: 768 }, locale: 'en-US', serviceWorkers: 'allow',
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    args: ['--no-sandbox', '--disable-background-networking'],
  });
  await installDmWire(context, fixture.relayUrl); await context.addInitScript(installPrivateCacheProbe);
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    const put = (key, value) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); };
    put('lkjstr:migration', 'owner-audit-1');
    put('lkjstr:layout:guest', { type: 'pane', id: 'private-guest', tabs: ['global'], active: 'global' });
    put('lkjstr:layout:main', { type: 'pane', id: 'private-reader', tabs: ['messages'], active: 'messages' });
  });
  page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => { if (report.errors.length < 20) report.errors.push({ stage, name: error.name }); });
  await page.goto(fixture.base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.dmUi?.ready && window.dmUi?.accounts));
  check('realEngine', await page.evaluate(() => window.dmUi.ready.engine !== 'mock' && window.dmUi.ready.version >= 8));
  report.browser = context.browser()?.version() ?? 'persistent Chromium';
};
const measure = async (name, action) => {
  if (stopped) throw Error('Interrupted'); stage = name;
  const before = fixture.snapshot(); check(name + ':control', await action());
  const dom = await waitPrivatePaint(page), after = fixture.snapshot();
  const traffic = Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));
  report.visits.push({ name, dom, traffic,
    cacheConfirmedWithin100: Number.isFinite(dom?.paintedMs) && dom.paintedMs <= 100 && dom.bodyPresent && traffic.events === 0 });
  await save(); return Boolean(dom?.bodyPresent);
};
await save();
try {
  const frozen = directory + '/dist', source = await realpath(resolve(root, args.build ?? 'dist'));
  await cp(source, frozen, { recursive: true }); report.build = await buildIdentity(frozen); report.sourceBuild = source;
  report.harnessHashes = {};
  for (const name of (await readdir(root + '/scripts')).filter(name => name.startsWith('cache-repeat-private') && name.endsWith('.mjs')))
    report.harnessHashes[name] = createHash('sha256').update(await readFile(root + '/scripts/' + name)).digest('hex');
  fixture = await privateFixture(frozen); report.fixture = { base: fixture.base, relayUrl: fixture.relayUrl, csp: fixture.csp };
  const profile = directory + '/profile'; await launch(profile); stage = 'fresh encrypted setup';
  const accounts = await setupPrivateReader(page, fixture.relayUrl); report.accounts = accounts;
  check('twoFreshPublicIdentities', accounts.owner !== accounts.peer);
  check('bothKeysPersistedOnlyEncrypted', await privateKeysProtected(page, [accounts.owner, accounts.peer]));
  check('initialConversation', await openPrivateConversation(page));
  check('initialPrivateBody', (await waitPrivatePaint(page)).bodyPresent);
  report.initialTraffic = fixture.snapshot(); fixture.silence(); report.relayReplayWithheld = true;
  await measure('inbox reopened', () => closePrivateConversation(page));
  await measure('conversation reopened', () => openPrivateConversation(page));
  stage = 'lock'; await privateAct(page, { a: 'account.lock', pubkey: accounts.owner });
  await page.waitForFunction(owner => window.dmUi.accounts.accounts.find(account => account.author.pubkey === owner)?.locked, accounts.owner);
  await page.waitForFunction(marker => ![...document.querySelectorAll('.view')]
    .some(view => view.getClientRects().length && view.textContent.includes(marker)), privateMarker);
  report.locked = await privateLocked(page, accounts.owner); check('lockedContentHidden', report.locked.locked && !report.locked.plaintextVisible);
  stage = 'locked reload'; await page.reload(); await page.waitForFunction(() => Boolean(window.dmUi?.accounts));
  report.afterReload = await privateLocked(page, accounts.owner); check('reloadStaysLocked', report.afterReload.locked && !report.afterReload.plaintextVisible);
  stage = 'browser restart'; await context.close(); context = undefined;
  await launch(profile); report.browserRestarted = true;
  report.afterRestart = await privateLocked(page, accounts.owner);
  check('restartStaysLocked', report.afterRestart.locked && !report.afterRestart.plaintextVisible);
  const cached = await measure('after unlock after browser restart', () => unlockPrivateReader(page, accounts.owner));
  if (cached) {
    await measure('inbox reopened after unlock', () => closePrivateConversation(page));
    await measure('conversation reopened after unlock', () => openPrivateConversation(page));
  } else report.scope.push('Stored private body was unavailable with relay replay withheld; cached reopen after unlock was not measured.');
  stage = 'public storage privacy'; report.storage = await archiveDisk(page, [accounts.owner, accounts.peer], [privateMarker]);
  check('privateBodyAbsentFromPublicStorage', report.storage.privateTextAbsent);
  check('relayHasOnlyEncryptedMessageWrappers', fixture.fake.published.some(event => event.kind === 1059) &&
    !fixture.fake.published.some(event => [4, 13, 14].includes(event.kind) || event.content.includes(privateMarker)));
  check('noPageErrors', report.errors.length === 0); report.complete = !stopped;
} catch (error) {
  report.failure = { stage, name: error?.name ?? 'Error' }; report.complete = false; process.exitCode = 1;
} finally {
  report.cleanup = {};
  for (const [name, close] of [['browser', () => context?.close()], ['fixture', () => fixture?.close()]]) {
    try { await close(); report.cleanup[name] = true; }
    catch { report.cleanup[name] = false; report.complete = false; report.errors.push({ stage: 'cleanup', name }); process.exitCode = 1; }
  }
  for (const name of ['profile', 'cache', 'config', 'data']) {
    try { await rm(directory + '/' + name, { recursive: true, force: true }); report.cleanup[name] = true; }
    catch { report.cleanup[name] = false; report.complete = false; report.errors.push({ stage: 'cleanup', name }); process.exitCode = 1; }
  }
  report.finished = new Date().toISOString(); report.finalLoadAverage = loadavg(); await save();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.off(signal, stop);
}
console.log(directory + '/report.json');
