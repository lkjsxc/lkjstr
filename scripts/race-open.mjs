// Opt-in comparison of exact releases. No build, signing, publication, owner profile, or default-gate hook.
import { mkdir, cp, writeFile, readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { loadavg } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { devices } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { ownedDirectory } from './real-hour-owned.mjs';
import { publicAccount } from './real-hour-public.mjs';
import { buildIdentity } from './real-hour-browser.mjs';
import { startStatic, productionPolicy } from './race-server.mjs';
import { defaultNpub, publicIdentity, saveReport, priorRun, fileHash } from './race-report.mjs';
import { startEdgeRoute, verifyLiveIndex } from './race-route.mjs';
import { scheduleRace } from './race-schedule.mjs';
const root = new URL('../', import.meta.url).pathname;
process.chdir(root);
const option = (name, fallback) => process.argv.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;
if (process.argv.includes('--help')) {
  console.log('pnpm race:open --build=dist --verify-helper=PATH [--account=npub...] [--runs=5] [--situations=cold,five-minute,day-use,phone]');
  console.log('Optional --host-route=archserver maps only lkjsxc.com/lkjstr.lkjsxc.com through an owned TLS-preserving SSH forward.');
  console.log('Baseline: --situations=cold,five-minute,phone. Later hour: --profiles-from=tmp/RUN --situations=day-use.');
  console.log('Calibration only: --runs=1 --duration-ms=15000 --situations=cold. Default day-use is a real 3600s Home-scroll workload per client, not 24h aging.');
  process.exit(0);
}
const requestedRuns = Number(option('runs', '5')), durationMs = Number(option('duration-ms', '45000'));
const warmSeconds = Number(option('warm-seconds', '300')), useSeconds = Number(option('use-seconds', '3600'));
const schemaVersion = Number(option('account-schema', '2'));
if (!Number.isInteger(requestedRuns) || requestedRuns < 1 || requestedRuns > 10) throw Error('runs must be 1..10');
if (!Number.isInteger(durationMs) || durationMs < 5000 || durationMs > 120000) throw Error('duration-ms must be 5000..120000');
if (warmSeconds !== 300) throw Error('five-minute requires 300 real seconds; use --situations=cold for a quick check');
if (!Number.isInteger(useSeconds) || useSeconds < 60 || useSeconds > 86400) throw Error('use-seconds must be 60..86400');
if (![1, 2].includes(schemaVersion)) throw Error('Unsupported public account schema');
const situations = new Set(option('situations', 'cold,five-minute,day-use,phone').split(','));
if ([...situations].some(item => !['cold', 'five-minute', 'day-use', 'phone'].includes(item))) throw Error('Unknown situation');
const prior = option('profiles-from') ? await priorRun(option('profiles-from')) : null;
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const directory = await ownedDirectory(root, option('output', 'tmp/race-open-' + stamp), true);
const report = { ownership: { kind: 'lkjstr-open-race', id: randomUUID(), root: await realpath(root), directory },
  started: new Date().toISOString(), initialLoadAverage: loadavg(), requestedRuns, durationMs,
  runtime: { node: process.version, playwright: createRequire(import.meta.url)('playwright-core/package.json').version },
  scenarios: [...situations], worktreeRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  runs: [], foundations: {}, limitations: [
    'Cold Home means only the public account identity is seeded. All event/metadata/HTTP/SW caches are empty; browser process restarts after setup. This excludes interactive onboarding.',
    'The first-ten mark is the FIRST ten top-level Home note rows in DOM order, with non-key names and loaded non-placeholder avatars. It is not ten notes simultaneously fitting the viewport.',
    'Settled-author secondary marks accept decoded pictures or the existing explicit no-picture/image-error placeholder after a real name is present; strict marks remain separate and fallback reasons are retained.',
    'First-screen requires a filled viewport and every intersecting note to have a non-key name and loaded non-placeholder avatar. Missing original metadata/images are reported unavailable, never skipped.',
    'DOM visibility is sampled at animation frames and confirmed one frame later. It is a paint opportunity, not a compositor trace. First rest is two quiet seconds; final rest and later shifts expose delayed movement.',
    'Both clients use a small Blob worker trampoline for fail-closed read-only WebSocket guards; original release files and service workers are unchanged. CDP pauses page/worker targets only to enable network capture; SW resumes before capture to avoid a Chrome startup deadlock. Timings include these measured instrumentation delays.',
    'SW remains enabled. Only public identities exist; no extension, local secret or remote signer is installed. SW source was reviewed for caching/share-target behavior; it is not replaced by a test SW.',
    'HTTP encoded transfer bytes and WebSocket UTF-8 payload bytes are separate; their sum excludes WebSocket framing/TLS/compression overhead. All metrics share the fixed observation window.',
    'Day-use means the recorded real-duration Home-scroll working-set workload and actual profile age. A one-hour workload is not a full day or a simulated clock advance; complete-day victory is not claimed.',
    'A missing or invalid run makes its median unavailable; no failed run is dropped to improve the comparison. Fallback names/images cannot establish resolved metadata.',
  ] };
let server, edgeRoute;
let stopSignal;
const requestStop = signal => { stopSignal ??= signal; console.log(JSON.stringify({ phase: 'stopping-after-observation', signal })); };
const onInterrupt = () => requestStop('SIGINT'), onTerminate = () => requestStop('SIGTERM'), onHangup = () => requestStop('SIGHUP');
process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate); process.on('SIGHUP', onHangup);
const save = async () => saveReport(directory, report);
await save();
try {
  process.env.TMPDIR = resolve(option('temp-dir', process.env.LKJSTR_RACE_TMP ?? resolve(root, 'tmp/t')));
  if (process.env.TMPDIR.length > 60) throw Error('Chromium socket path is too long; supply --temp-dir inside the project with a path under 60 characters');
  await mkdir(process.env.TMPDIR, { recursive: true });
  await mkdir(directory + '/bin');
  const helper = resolve(option('verify-helper', 'target/debug/examples/engine-public-verify'));
  await cp(helper, directory + '/bin/engine-public-verify');
  process.env.LKJSTR_REAL_VERIFY = directory + '/bin/engine-public-verify';
  report.verifyHelper = { sha256: await fileHash(process.env.LKJSTR_REAL_VERIFY) };
  const preferred = publicIdentity(option('account', prior?.account?.npub ?? defaultNpub));
  const relays = option('relays', 'wss://yabu.me/,wss://nos.lol/,wss://relay.damus.io/').split(',');
  let publicData;
  try {
    publicData = await publicAccount(relays, preferred.pubkey);
    if (publicData.follows.length < 100) throw Error('Preferred account has fewer than 100 verified follows');
  } catch (error) {
    if (option('account') || prior) throw error;
    report.accountFallback = String(error);
    publicData = await publicAccount(relays);
    if (publicData.follows.length < 100) throw Error('No busy verified public account was found');
  }
  const account = { ...publicIdentity(publicData.pubkey), follows: publicData.follows.length, followEvent: publicData.followEvent.id };
  report.account = account; report.publicPreflight = { relays: publicData.relays, probes: publicData.probes };
  // Verified preflight events stay outside the browser; identity is the only imported datum.
  await writeFile(directory + '/public-account.json', JSON.stringify(publicData));
  const source = resolve(option('build', 'dist')), snapshot = directory + '/dist';
  await cp(source, snapshot, { recursive: true }); report.build = await buildIdentity(snapshot);
  report.buildSource = { directory: source, assertedRevision: option('build-revision') ?? null };
  await mkdir(directory + '/harness');
  report.harnessHashes = {};
  for (const name of (await readdir(resolve(root, 'scripts'))).filter(name => name.startsWith('race-') && name.endsWith('.mjs'))) {
    await cp(resolve(root, 'scripts', name), directory + '/harness/' + name);
    report.harnessHashes[name] = await fileHash(resolve(root, 'scripts', name));
  }
  const routeName = option('host-route', prior?.networkRoute?.kind === 'archserver-edge-tcp' ? 'archserver' : undefined);
  if (routeName && routeName !== 'archserver') throw Error('Only the explicitly scoped archserver edge route is supported');
  if (routeName) {
    edgeRoute = await startEdgeRoute(directory); report.networkRoute = edgeRoute.evidence;
    report.limitations.push('Chrome classifies the TCP-forward endpoint as loopback. Each fresh reader is granted local-network-access only for its own measured app origin; the same permission is applied to both clients. TLS checks, original URLs and all other browser security settings remain enabled.');
    report.limitations.push('The two lkjstr public hostnames use one owned SSH TCP route to the actual serving edge for both clients. TLS and body bytes are unchanged; route/probe latency is recorded. Other origins and relays keep the workspace network. This is a disclosed reachability correction, not the ordinary public route.');
  }
  const liveUrl = option('lkjstr-url', prior?.serving?.liveUrl);
  let lkjstrBase;
  if (liveUrl) {
    const url = new URL(liveUrl);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('A public HTTPS lkjstr URL is required');
    lkjstrBase = url.origin;
    const expectedIndex = report.build.find(item => item.path === 'index.html');
    const observedIndex = await verifyLiveIndex(lkjstrBase, expectedIndex?.sha256, directory, edgeRoute);
    report.serving = { kind: 'public-live', liveUrl: lkjstrBase, expectedBuildManifest: report.build, observedIndex };
  } else {
    const port = prior?.serving?.localBase ? Number(new URL(prior.serving.localBase).port) : 0;
    server = await startStatic(snapshot, port); lkjstrBase = server.base;
    report.serving = { kind: 'local-exact-files-production-policy', localBase: server.base, policy: productionPolicy };
    report.limitations.push('lkjstr shell is served from loopback with production MIME/cache/CSP/gzip policy; nostter shell traverses its public CDN. Relays share the same host/network. Local HTTP lacks the live TLS/WAN leg, so this is not a live-site transport victory.');
  }
  report.mobile = { emulatedUserAgent: devices['Pixel 7'].userAgent,
    cpuScope: 'CDP page main-thread throttling; worker CPU, GPU, disk and physical-device equivalence are not established',
    classification: 'Reproducible synthetic phone profile, not calibrated physical mid-range hardware', viewport: '393x852', deviceScaleFactor: 2, cpuSlowdown: 4, roundTripLatencyMs: 150,
    downloadBytesPerSecond: 200000, uploadBytesPerSecond: 93750, networkMethod: 'Network.emulateNetworkConditionsByRule', note: 'Rule IDs and affected-request counts retained for page and engine/verification/SW network targets; dedicated-worker navigator state is not explicitly overridden' };
  report.prior = prior ? { directory: prior.ownership.directory, started: prior.started, build: prior.build,
    matrixComplete: prior.complete === true, profileReuse: prior.profileReuse } : null;
  await save();
  await scheduleRace({ directory, report, sites: { nostter: 'https://nostter.app', lkjstr: lkjstrBase },
    account, requestedRuns, durationMs, situations, warmSeconds, useSeconds, schemaVersion, save, prior,
    hostResolverRules: edgeRoute?.resolverRules, stopRequested: () => Boolean(stopSignal) });
  report.complete = !stopSignal && report.runs.length > 0 && report.runs.every(run => !run.failure && run.validReadOnly);
  if (!report.complete) process.exitCode = 1;
} catch (error) { report.complete = false; report.failure = String(error?.stack ?? error).slice(0, 4000); process.exitCode = stopSignal ? 130 : 1; }
finally {
  report.finished = new Date().toISOString(); report.finalLoadAverage = loadavg();
  if (stopSignal) { report.complete = false; report.interrupted = { signal: stopSignal, at: report.finished }; }
  const cleanup = await Promise.allSettled([server?.close(), edgeRoute?.close()]);
  const failures = cleanup.filter(item => item.status === 'rejected').map(item => String(item.reason));
  if (failures.length) { report.cleanupFailure = failures; report.complete = false; process.exitCode = 1; }
  await save(); process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate); process.off('SIGHUP', onHangup);
  console.log(JSON.stringify({ phase: 'finished', directory, complete: report.complete ?? false, failure: report.failure }));
}
