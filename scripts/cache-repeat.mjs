// Opt-in public cache reuse measurement. No default gate, build, signing or publication.
import { cp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadavg } from 'node:os';
import { delay } from './real-hour-public.mjs';
import { ownedDirectory } from './real-hour-owned.mjs';
import { buildIdentity } from './real-hour-browser.mjs';
import { openBrowser, seedIdentity, readerState } from './race-profile.mjs';
import { defaultNpub, publicIdentity } from './race-report.mjs';
import { startStatic, productionPolicy } from './race-server.mjs';
import { startEdgeRoute } from './race-route.mjs';
import { options, visitPlan, classifyVisit } from './cache-repeat-model.mjs';
import { repeatNetwork } from './cache-repeat-network.mjs';
import { observeRepeat } from './cache-repeat-observe.mjs';
import { discoverTarget, targetFor, openVisit, dwell, reloadVisit } from './cache-repeat-ui.mjs';
import { saveRepeat } from './cache-repeat-report.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const args = options(process.argv.slice(2)), account = publicIdentity(args.account ?? defaultNpub);
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const directory = await ownedDirectory(root, args.output ?? 'tmp/cache-repeat-' + stamp, true);
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
process.env.TMPDIR = resolve(common, '..', 'tmp/t');
await mkdir(process.env.TMPDIR, { recursive: true });
for (const [variable, child] of [['XDG_CACHE_HOME', 'cache'], ['XDG_CONFIG_HOME', 'config'], ['XDG_DATA_HOME', 'data']])
  process.env[variable] = directory + '/' + child;
const plan = visitPlan(args.seconds, args.visitSeconds), first = plan[0];
const report = { schema: 'lkjstr-cache-repeat-1', ownership: { kind: 'lkjstr-cache-repeat', id: randomUUID(),
  root: await realpath(root), directory }, started: new Date().toISOString(),
  harnessRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  harnessDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  requestedSeconds: args.seconds, visitSeconds: args.visitSeconds, initialLoadAverage: loadavg(),
  account, plan, visits: [], phaseDurations: {}, policy: productionPolicy, errors: [],
  coverageGaps: ['Named lists have an engine source but no mounted tile in this frontend.',
    'Private messages are excluded from this public read-only account; a separate unlocked loopback fixture is required.',
    'An empty or unavailable public view cannot establish a previously held screen and is reported separately.',
    'No full-browser restart is claimed: the second phase uses a normal page reload with the same HTTP, SW and event caches.',
    'An overlapping relay EVENT makes cache origin unknown even when the matching public row was already held.',
    'These row/name/avatar marks do not verify counts, NIP-05 status, media dimensions or relay-row metadata.'] };
const save = () => saveRepeat(directory, report), network = repeatNetwork(), held = new Map();
let browser, server, route, detach, seed = { account, notes: [], search: args.search }, known = [], stopped = false;
const stop = () => { stopped = true; report.interrupted = true; };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
await save();
const guard = async () => {
  const state = await readerState(browser.page, 'lkjstr', account), observed = await browser.cdp.sample();
  const valid = state.readOnly && observed.guards.length > 0 && observed.guards.every(item =>
    item.guard && item.guard.forbidden === 0) && observed.forbiddenSentFrames === 0 && observed.errors.length === 0;
  if (!valid) throw Error('The public reader or target read-only guards could not be verified');
  return { reader: state, network: observed };
};
try {
  const source = await realpath(resolve(root, args.build)), frozen = directory + '/dist';
  await cp(source, frozen, { recursive: true }); report.build = await buildIdentity(frozen);
  report.sourceBuild = source; report.harnessHashes = {};
  for (const name of (await readdir(resolve(root, 'scripts'))).filter(name =>
    /^(cache-repeat|race-|real-hour-(browser|owned|public))/.test(name) && name.endsWith('.mjs'))) {
    const bytes = await readFile(resolve(root, 'scripts', name));
    report.harnessHashes[name] = createHash('sha256').update(bytes).digest('hex');
  }
  server = await startStatic(frozen); report.base = server.base;
  if (args.route === 'host') { route = await startEdgeRoute(directory); report.route = route.evidence; }
  else report.route = { mode: 'workspace-direct', localApp: true };
  const profile = directory + '/profile', hostResolverRules = route?.resolverRules;
  report.seed = await seedIdentity({ profile, site: 'lkjstr', base: server.base,
    account, schemaVersion: args.schema, hostResolverRules });
  if (stopped) throw Error('Interrupted before browser measurement');
  browser = await openBrowser(profile, { site: 'lkjstr', observe: false, hostResolverRules, base: server.base });
  report.routePermission = browser.routePermission;
  report.browser = browser.browserVersion;
  await browser.context.addInitScript(observeRepeat, { initial: { id: first.id, kind: first.kind } });
  browser.page.on('pageerror', error => { if (report.errors.length < 20) report.errors.push(String(error).slice(0, 600)); });
  detach = browser.cdp.listenNetwork(network.observe); browser.cdp.start();
  for (const phase of ['first', 'repeat']) {
    if (stopped) throw Error('Interrupted before the full protocol completed');
    network.beginPhase(phase); const phaseStart = Date.now();
    for (const step of plan) {
      if (stopped) throw Error('Interrupted before the full protocol completed');
      const target = targetFor(step, seed), expected = held.get(target.key) ?? { keys: [], authors: [] };
      const deadline = phaseStart + (step.offsetSeconds + step.dwellSeconds) * 1000;
      const row = { phase, ...step, target, expected, loadAverage: loadavg(), scheduledEnd: deadline };
      network.beginVisit(step.id);
      try {
        let mark;
        if (step === first) {
          if (phase === 'first') await browser.page.goto(server.base, { waitUntil: 'domcontentloaded', timeout: 45000 });
          else await reloadVisit(browser.page, { id: step.id, kind: step.kind, expected }, known);
          mark = await browser.page.evaluate(() => ({ startedAt: globalThis.__cacheRepeat.snapshot()?.startedAt }));
        } else mark = await openVisit(browser.page, step, target, expected);
        if (mark.unavailable) {
          row.unavailable = mark.unavailable; row.network = network.endVisit(Date.now(), Date.now(), undefined);
        } else {
          if (!Number.isFinite(mark.startedAt)) throw Error('View opening timestamp was not observed');
          row.scroll = await dwell(browser.page, step, mark.startedAt, () => stopped, deadline);
          const dom = await browser.page.evaluate(() => globalThis.__cacheRepeat.end());
          if (!dom || dom.id !== step.id) throw Error('Measured view identity changed');
          known = dom.known; delete dom.known; row.dom = dom;
          row.network = network.endVisit(dom.startedAt, dom.endedAt,
            Number.isFinite(dom.cachedScreenMs) ? dom.startedAt + dom.cachedScreenMs : undefined);
          if (dom.screen?.keys.length) held.set(target.key, { keys: dom.screen.keys, authors: dom.screen.authors });
          else held.delete(target.key);
          if (phase === 'first' && step === first) {
            seed = await discoverTarget(browser.page, account, args.search); report.targets = seed;
            report.firstReader = await guard();
          }
        }
      } catch (error) {
        row.unavailable = String(error).slice(0, 700);
        row.network = network.endVisit(Date.now(), Date.now(), undefined);
        if (/read-only guards|public reader/.test(row.unavailable)) throw error;
      }
      while (Date.now() < deadline && !stopped) await delay(Math.min(250, deadline - Date.now()));
      row.scheduleOverrunMs = Math.max(0, Date.now() - deadline);
      row.result = classifyVisit(row); report.visits.push(row); report.traffic = network.summary();
      report.knownAuthorCount = known.length; await save();
      console.log(JSON.stringify({ phase, visit: step.id, kind: step.kind, outcome: row.result.status,
        firstContentMs: row.dom?.firstContentMs, cachedScreenMs: row.dom?.cachedScreenMs }));
    }
    network.endPhase(); report.phaseDurations[phase] = (Date.now() - phaseStart) / 1000;
    report[phase + 'Reader'] = await guard(); report.traffic = network.summary(); await save();
  }
  if (stopped) throw Error('Interrupted before the full protocol completed');
  report.complete = true;
} catch (error) {
  report.failure = String(error?.stack ?? error).slice(0, 4000); process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString(); report.finalLoadAverage = loadavg();
  report.traffic = network.summary(); detach?.();
  try { await save(); } catch { process.exitCode = 1; console.error('Cache-repeat evidence could not be saved'); }
  for (const resource of [browser, server, route]) {
    try { await resource?.close(); } catch (error) {
      process.exitCode = 1; report.cleanupFailure ??= String(error).slice(0, 500);
    }
  }
  report.cleanup = await Promise.allSettled(['profile', 'cache', 'config', 'data'].map(name =>
    rm(directory + '/' + name, { recursive: true, force: true }))).then(values =>
      values.map((value, index) => ({ directory: ['profile', 'cache', 'config', 'data'][index], removed: value.status === 'fulfilled' })));
  if (report.cleanup.some(row => !row.removed)) process.exitCode = 1;
  await save();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.off(signal, stop);
  console.log(JSON.stringify({ phase: 'finished', directory, complete: report.complete ?? false,
    completedHour: report.summary.completedHour, failure: report.failure }));
}
