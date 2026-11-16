// Opt-in real public-network measurement. Never part of a default test gate.
import { mkdir, cp, writeFile, rm, readFile, readdir, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { launchMeasured, buildIdentity } from './real-hour-browser.mjs';
import { publicAccount, delay } from './real-hour-public.mjs';
import { prepareReader, signInReadOnly, samplePage, scrollArchive, returnHomeTop, firstPaint } from './real-hour-ui.mjs';
import { comparePublic } from './real-hour-compare.mjs';
import { ownedDirectory } from './real-hour-owned.mjs';
const root = new URL('../', import.meta.url).pathname;
process.chdir(root);
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const seconds = Number(option('seconds', '3600'));
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400) throw Error('seconds must be 1..86400');
const scrollNotes = Number(option('scroll-notes', seconds >= 3600 ? '2000' : '120'));
if (!Number.isInteger(scrollNotes) || scrollNotes < 1 || scrollNotes > 10000) throw Error('scroll-notes must be 1..10000');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const directory = await ownedDirectory(root, option('output', `tmp/real-hour-${stamp}`), true);
// Keep Chromium's Unix-domain socket path below Linux's 108-byte bound.
process.env.TMPDIR = `${root}tmp/t`;
process.env.XDG_CACHE_HOME = `${directory}/cache`;
process.env.XDG_CONFIG_HOME = `${directory}/config`;
process.env.XDG_DATA_HOME = `${directory}/data`;
await mkdir(process.env.TMPDIR, { recursive: true });
const source = resolve(option('build', 'dist'));
const snapshot = `${directory}/dist`;
await cp(source, snapshot, { recursive: true });
const report = { ownership: { kind: 'lkjstr-real-hour', id: randomUUID(), root: await realpath(root), directory }, started: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktreeDirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
  mode: seconds >= 3600 ? 'hour' : 'short-validation', requestedLiveSeconds: seconds,
  build: await buildIdentity(snapshot), initialLoadAverage: loadavg(), samples: [], errors: [],
  browserCapabilities: { workers: 'same-origin modules only; guarded host-release bootstrap; classic/blob/cross-origin rejected', serviceWorkers: 'blocked: Chromium cannot install a guard before auto-paused service-worker execution; offline-shell behavior excluded' },
  instrumentation: 'A measured Worker bootstrap installs REQ/CLOSE guards and waits for host CDP Network readiness before importing original modules. Extra bootstrap fetch/import time is included; original release files are unchanged. JS heap, embedder heap and WASM linear memory are measured separately where supported; not total process RSS.' };
const save = async () => { await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); };
let measured, page;
const stop = () => { report.interrupted = true; };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
await save();
try {
  if (option('helpers', 'build') !== 'existing') {
  const native = spawnSync(`${process.env.HOME}/.cargo/bin/cargo`, ['build', '-q', '-p', 'lkjstr-core', '--example', 'engine-public-verify', '--example', 'engine-cold-fixtures'], { encoding: 'utf8', env: { ...process.env, CARGO_BUILD_JOBS: '4', RUST_TEST_THREADS: '4', CARGO_HOME: `${root}tmp/cargo-home`, CARGO_TARGET_DIR: `${root}target` }, maxBuffer: 2 * 1024 * 1024 });
  await writeFile(`${directory}/native-build.log`, (native.stdout ?? '') + (native.stderr ?? ''));
  if (native.status !== 0) throw Error('Native measurement helpers failed; see native-build.log');
  }
  report.helpers = option('helpers', 'build');
  await mkdir(`${directory}/bin`, { recursive: true });
  report.helperHashes = {};
  for (const name of ['engine-public-verify', 'engine-cold-fixtures']) {
    const destination = `${directory}/bin/${name}`;
    await cp(`target/debug/examples/${name}`, destination);
    report.helperHashes[name] = createHash('sha256').update(await readFile(destination)).digest('hex');
  }
  process.env.LKJSTR_REAL_VERIFY = `${directory}/bin/engine-public-verify`;
  process.env.LKJSTR_REAL_FIXTURE = `${directory}/bin/engine-cold-fixtures`;
  await mkdir(`${directory}/harness`, { recursive: true });
  report.harnessHashes = {};
  for (const name of (await readdir('scripts')).filter((name) => name.startsWith('real-hour') && name.endsWith('.mjs'))) {
    const content = await readFile(`scripts/${name}`);
    await writeFile(`${directory}/harness/${name}`, content);
    report.harnessHashes[name] = createHash('sha256').update(content).digest('hex');
  }
  const relays = option('relays', 'wss://yabu.me/,wss://nos.lol/,wss://relay.damus.io/').split(',');
  const account = await publicAccount(relays, option('account'));
  report.account = { pubkey: account.pubkey, follows: account.follows.length, followEvent: account.followEvent.id, relays: account.relays, probes: account.probes };
  await writeFile(`${directory}/account-public.json`, JSON.stringify(account));
  measured = await launchMeasured({ directory: snapshot, runDirectory: directory });
  await prepareReader(measured.context, account);
  page = measured.context.pages()[0] ?? await measured.context.newPage();
  page.on('pageerror', (error) => { if (report.errors.length < 30) report.errors.push(String(error)); });
  report.cold = await signInReadOnly(page, measured.base, account);
  report.firstTargets = await measured.cdp.sample();
  report.targetGuards = measured.cdp.guardStatus();
  if (measured.cdp.errors.length) throw Error(`Guard errors: ${measured.cdp.errors.join('; ')}`);
  if (!report.cold.readOnly) throw Error('read-only account was not confirmed');
  if (report.firstTargets.some((target) => target.type.includes('worker') && !target.probe)) throw Error('Worker read-only instrumentation missing');
  const startedAt = Date.now();
  report.liveStarted = new Date(startedAt).toISOString();
  console.log(JSON.stringify({ phase: 'live-started', directory, at: report.liveStarted, mode: report.mode, account: account.pubkey, relays: account.relays }));
  await save();
  const sample = async () => {
    const data = await samplePage(page);
    report.samples.push({ elapsedSeconds: (Date.now() - startedAt) / 1000, loadAverage: loadavg(), page: data, targets: await measured.cdp.sample(), hostNetwork: measured.cdp.networkEvidence.summary() });
    await save();
    console.log(JSON.stringify({ phase: 'sample', seconds: (Date.now() - startedAt) / 1000, events: data.physicalEvents, load: loadavg() }));
  };
  await sample();
  report.scroll = await scrollArchive(page, scrollNotes, scrollNotes > 120 ? 240000 : 15000);
  await returnHomeTop(page);
  await save();
  let nextSample = Date.now();
  while (Date.now() - startedAt < seconds * 1000 && !report.interrupted) {
    if (Date.now() >= nextSample) { await sample(); nextSample = Date.now() + 60000; }
    await delay(Math.min(1000, seconds * 1000 - (Date.now() - startedAt)));
  }
  await sample();
  if (report.interrupted) throw Error('Measurement interrupted; partial run only');
  const endedAt = Date.now();
  report.liveElapsedSeconds = (endedAt - startedAt) / 1000;
  report.savedSeen = await page.evaluate(() => globalThis.__realHour?.seen ?? {});
  report.audit = await comparePublic({ page, cdp: measured.cdp, account, startedAt, endedAt, savedSeen: report.savedSeen });
  await writeFile(`${directory}/public-control.json`, JSON.stringify(report.audit.controls));
  delete report.audit.controls;
  await save();
  if (seconds >= 3600 && !report.interrupted) {
    const { faultScenarios } = await import('./real-hour-scenarios.mjs');
    report.scenarios = await faultScenarios({ measured, page, account, directory, report, save });
    page = measured.context.pages().find((candidate) => !candidate.isClosed()) ?? page;
  }
  const warmStart = Date.now();
  await page.reload();
  report.warm = { ...await firstPaint(page, 'home', 30000, warmStart), reloadElapsedMs: Date.now() - warmStart };
  report.finalTargets = await measured.cdp.sample();
  report.cdpErrors = measured.cdp.errors;
  if (report.finalTargets.some((target) => target.probe?.forbidden > 0)) throw Error('Read-only guard blocked a forbidden outbound message');
  report.complete = !report.interrupted;
} catch (error) {
  report.failure = String(error?.stack ?? error).slice(0, 4000);
  process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString(); report.finalLoadAverage = loadavg();
  try {
    if (measured) {
      report.networkEvidence = measured.cdp.networkEvidence.summary();
      await writeFile(`${directory}/network-evidence.json`, JSON.stringify(measured.cdp.networkEvidence.snapshot()));
    }
    await save();
  } catch (error) {
    report.failure ??= String(error); process.exitCode = 1;
    console.error('Measurement report could not be saved:', String(error));
  } finally {
    try { await measured?.close(); } finally {
      const cleanup = await Promise.allSettled(['profile', 'cache', 'config', 'data'].map(folder =>
        rm(`${directory}/${folder}`, { recursive: true, force: true })));
      for (const result of cleanup) if (result.status === 'rejected') {
        process.exitCode = 1; console.error('Owned data cleanup failed:', String(result.reason));
      }
    }
  }
  console.log(JSON.stringify({ phase: 'finished', directory, complete: report.complete ?? false, failure: report.failure }));
}
