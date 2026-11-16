// Disrupt only this harness's fresh pages/sockets. No host network changes.
import { delay } from './real-hour-public.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { firstPaint, samplePage } from './real-hour-ui.mjs';
const place = (page) => page.evaluate(() => {
  const view = document.querySelector('.view[data-kind="home"]');
  const top = view?.getBoundingClientRect().top ?? 0;
  const node = [...(view?.querySelectorAll('.note') ?? [])].find((note) => note.getBoundingClientRect().bottom > top + 30);
  return node ? { id: node.dataset.note, offset: node.getBoundingClientRect().top - top } : null;
});
async function recovery(cdp, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const targets = await cdp.sample();
    if (targets.some((target) => target.probe?.sockets.some((socket) => socket.readyState === 1 && socket.subscriptions > 0)))
      return { connectedMs: Date.now() - start, targets };
    await delay(500);
  }
  return { failed: 'No subscribed open relay socket within 60 seconds', targets: await cdp.sample() };
}
async function setNetwork(measured, online) {
  const statuses = [];
  for (const [session, target] of measured.cdp.sessions) {
    try {
      await measured.cdp.send('Network.enable', {}, session);
      await measured.cdp.send('Network.emulateNetworkConditions', { offline: !online, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, session);
      statuses.push({ type: target.type, emulated: true });
    } catch (error) { statuses.push({ type: target.type, emulated: false, error: String(error) }); }
  }
  await measured.cdp.network(online);
  return statuses;
}
export async function faultScenarios({ measured, page, account, directory, report, save }) {
  const out = {};
  report.scenarios = out;
  if (!report.audit?.nativeEligibility) {
    const { auditControls } = await import('./real-hour-audit.mjs');
    const controls = JSON.parse(await readFile(`${directory}/public-control.json`, 'utf8'));
    report.audit = await auditControls({ page, cdp: measured.cdp, account, controls, savedSeen: report.savedSeen,
      startedAt: Date.parse(report.liveStarted), endedAt: Date.parse(report.liveStarted) + report.liveElapsedSeconds * 1000 });
    await writeFile(`${directory}/public-control.json`, JSON.stringify(report.audit.controls));
    delete report.audit.controls;
    await save();
  }
  const { inspectThread } = await import('./real-hour-thread.mjs');
  out.thread = await inspectThread({ page, cdp: measured.cdp, account, directory });
  await save();
  for (const seconds of [30, 600]) {
    const before = await place(page);
    const start = Date.now();
    const emulation = await setNetwork(measured, false);
    const key = `outage${seconds}`;
    out[key] = { started: new Date(start).toISOString(), requestedSeconds: seconds, before, emulation };
    await save();
    for (let elapsed = 0; elapsed < seconds; elapsed += 30) {
      await delay(Math.min(30, seconds - elapsed) * 1000);
      out[key].elapsedSeconds = (Date.now() - start) / 1000;
      await save();
      if (report.interrupted) throw Error('Measurement interrupted during controlled outage');
    }
    out[key].offlineTargets = await measured.cdp.sample();
    out[key].resumeEmulation = await setNetwork(measured, true);
    out[key].recovery = await recovery(measured.cdp);
    out[key].after = await place(page);
    out[key].page = await samplePage(page);
    await save();
  }
  const pageCdp = await measured.context.newCDPSession(page);
  out.freeze = { before: await place(page), seconds: 30, scope: 'Only the page target is frozen; SharedWorker may remain active. This is not an OS-sleep simulation.' };
  const freezeStart = Date.now();
  await pageCdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await delay(30000);
  await pageCdp.send('Page.setWebLifecycleState', { state: 'active' });
  out.freeze.elapsedSeconds = (Date.now() - freezeStart) / 1000;
  out.freeze.recovery = await recovery(measured.cdp);
  out.freeze.after = await place(page);
  await pageCdp.detach();
  await save();
  const second = await measured.context.newPage();
  await second.goto(measured.base);
  out.sharedTabs = { mode: 'SharedWorker: closing the first page tests persistence, not Web Locks leader replacement', second: await firstPaint(second, 'home', 30000), beforeClose: await measured.cdp.sample() };
  await page.close();
  out.sharedTabs.recovery = await recovery(measured.cdp);
  out.sharedTabs.afterClose = await samplePage(second);
  await save();
  const { cacheBoot, dedicatedLeader } = await import('./real-hour-extra.mjs');
  out.cache20000 = await cacheBoot({ directory, account, snapshot: `${directory}/dist` });
  await save();
  out.dedicatedLeader = await dedicatedLeader({ directory, account, snapshot: `${directory}/dist` });
  await save();
  const { workerPause } = await import('./real-hour-sleep.mjs');
  out.workerPause = await workerPause({ directory: `${directory}/worker-pause`, account, snapshot: `${directory}/dist` });
  await save();
  return out;
}
