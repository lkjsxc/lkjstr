// Pauses only a fresh harness page and its Worker execution, never the host.
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { launchMeasured } from './real-hour-browser.mjs';
import { prepareReader, signInReadOnly, samplePage } from './real-hour-ui.mjs';
import { delay } from './real-hour-public.mjs';
export async function workerPause({ directory, snapshot, account }) {
  await mkdir(directory, { recursive: true });
  const measured = await launchMeasured({ directory: snapshot, runDirectory: directory });
  const result = { started: new Date().toISOString(), loadAverage: loadavg(), seconds: 30,
    scope: 'Fresh page frozen, actual engine Worker execution paused through Debugger, owned sockets/HTTP cut. Service workers are blocked because before-execution instrumentation is unsupported; not host or OS sleep.' };
  const paused = [], armed = new Set();
  let pageCdp;
  try {
    await prepareReader(measured.context, account);
    const page = measured.context.pages()[0];
    result.startup = await signInReadOnly(page, measured.base, account);
    if (!result.startup.readOnly) throw Error('read-only account not confirmed');
    await delay(3000);
    result.before = await samplePage(page);
    result.guards = measured.cdp.guardStatus();
    if (measured.cdp.errors.length) throw Error(`Guard errors: ${measured.cdp.errors.join('; ')}`);
    result.networkCut = await measured.cdp.network(false);
    result.targets = [];
    for (const [session, target] of measured.cdp.sessions) {
      if (!['worker', 'shared_worker'].includes(target.type) || !/engine-(?:shared|worker)-/.test(target.url)) continue;
      const entry = { id: target.targetId, type: target.type, session };
      result.targets.push(entry);
      try {
        entry.clockBefore = await measured.cdp.evaluate(session, '({wall:Date.now(),monotonic:performance.now()})', 2000);
        armed.add(session);
        await measured.cdp.send('Debugger.enable', {}, session, 2000);
        await measured.cdp.send('Debugger.pause', {}, session, 2000);
        for (let i = 0; i < 40 && !measured.cdp.debuggerEvents.some((event) => event.session === session && event.method === 'Debugger.paused'); i++) await delay(50);
        entry.paused = measured.cdp.debuggerEvents.some((event) => event.session === session && event.method === 'Debugger.paused');
        if (entry.paused) paused.push([session, entry]);
        else await measured.cdp.send('Debugger.disable', {}, session, 2000);
      } catch (error) { entry.unsupported = String(error); }
    }
    if (!paused.some(([, entry]) => ['shared_worker', 'worker'].includes(entry.type))) throw Error('Engine Worker could not be paused');
    pageCdp = await measured.context.newCDPSession(page);
    await pageCdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    const start = Date.now();
    await delay(30000);
    result.frozenElapsedSeconds = (Date.now() - start) / 1000;
    for (const [session, entry] of paused) {
      await measured.cdp.send('Debugger.resume', {}, session, 2000);
      entry.clockAfter = await measured.cdp.evaluate(session, '({wall:Date.now(),monotonic:performance.now()})', 2000);
      entry.wallGapMs = entry.clockAfter.wall - entry.clockBefore.wall;
      await measured.cdp.send('Debugger.disable', {}, session, 2000);
    }
    paused.length = 0;
    await pageCdp.send('Page.setWebLifecycleState', { state: 'active' });
    result.resumeNetwork = await measured.cdp.network(true);
    const resume = Date.now();
    while (Date.now() - resume < 60000) {
      const targets = await measured.cdp.sample();
      if (targets.some((target) => target.probe?.sockets.some((socket) => socket.readyState === 1 && socket.subscriptions))) {
        result.recovery = { subscribedMs: Date.now() - resume, targets }; break;
      }
      await delay(500);
    }
    result.recovery ??= { failed: 'No subscribed relay socket within 60 seconds' };
    result.after = await samplePage(page);
    result.debuggerEvents = measured.cdp.debuggerEvents;
    result.complete = true;
  } catch (error) { result.failure = String(error?.stack ?? error).slice(0, 2000); }
  finally {
    for (const session of armed) {
      await measured.cdp.send('Debugger.resume', {}, session, 2000).catch(() => {});
      await measured.cdp.send('Debugger.disable', {}, session, 2000).catch(() => {});
    }
    await pageCdp?.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
    await pageCdp?.detach().catch(() => {});
    result.finished = new Date().toISOString(); result.finalLoadAverage = loadavg();
    await measured.close();
    for (const folder of ['profile', 'cache', 'config', 'data']) await rm(`${directory}/${folder}`, { recursive: true, force: true });
    await writeFile(`${directory}/report.json`, JSON.stringify(result, null, 2));
  }
  return result;
}
if (process.argv.includes('--run')) {
  const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const root = new URL('../', import.meta.url).pathname;
  process.chdir(root); process.env.TMPDIR = `${root}tmp/t`;
  const directory = resolve(option('output'));
  for (const [name, folder] of [['XDG_CACHE_HOME','cache'],['XDG_CONFIG_HOME','config'],['XDG_DATA_HOME','data']]) process.env[name] = `${directory}/${folder}`;
  const result = await workerPause({ directory, snapshot: resolve(option('build')), account: JSON.parse(await readFile(option('account-file'), 'utf8')) });
  console.log(JSON.stringify({ complete: result.complete, failure: result.failure, directory }));
  if (!result.complete) process.exitCode = 1;
}
