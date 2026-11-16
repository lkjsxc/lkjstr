// Fresh profiles for cold disk boot and the dedicated-Worker leader fallback.
import { mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { bech32 } from '../web/scripts/smoke-visitors.mjs';
import { launchMeasured } from './real-hour-browser.mjs';
import { prepareReader, signInReadOnly, firstPaint, samplePage } from './real-hour-ui.mjs';
import { delay } from './real-hour-public.mjs';
export async function cacheBoot({ directory, snapshot }) {
  const runDirectory = `${directory}/cache-20000`;
  await mkdir(runDirectory, { recursive: true });
  const fixture = JSON.parse(execFileSync(process.env.LKJSTR_REAL_FIXTURE ?? 'target/debug/examples/engine-cold-fixtures', ['20000'], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  }));
  const pubkey = JSON.parse(fixture[0].raw)[2];
  const measured = await launchMeasured({ directory: snapshot, runDirectory });
  try {
    const page = measured.context.pages()[0];
    await page.goto(`${measured.base}/__blank`);
    const seed = await page.evaluate(async (rows) => {
      localStorage.setItem('lkjstr:relays:', '[]');
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open('lkjstr-wasm', 1);
        open.onupgradeneeded = () => {
          const events = open.result.createObjectStore('events', { keyPath: 'id' });
          events.createIndex('created_at', 'created_at'); open.result.createObjectStore('kv');
        };
        open.onsuccess = () => resolve(open.result); open.onerror = reject;
      });
      const start = performance.now();
      for (let offset = 0; offset < rows.length; offset += 1000) await new Promise((resolve, reject) => {
        const transaction = db.transaction('events', 'readwrite');
        for (const row of rows.slice(offset, offset + 1000)) transaction.objectStore('events').put(row);
        transaction.oncomplete = resolve; transaction.onabort = reject;
      });
      const count = await new Promise((resolve) => {
        const request = db.transaction('events').objectStore('events').count(); request.onsuccess = () => resolve(request.result);
      });
      db.close(); return { seedMs: performance.now() - start, physicalRows: count };
    }, fixture);
    const start = Date.now();
    await page.goto(`${measured.base}/p/${bech32('npub', pubkey)}`);
    let firstNoteMs, failure;
    try { await page.locator('.view[data-kind="profile"] .note').first().waitFor({ timeout: 45000 }); firstNoteMs = Date.now() - start; }
    catch (error) { failure = String(error).slice(0, 300); }
    await delay(3000);
    return { ...seed, firstNoteMs, failure, page: await samplePage(page), targets: await measured.cdp.sample(),
      fixture: '20000 signed synthetic notes; generated local key stays inside Rust; no public relay configured and no publication. Profile view avoids signed-out no-profile filtering.' };
  } finally { await measured.close(); await rm(`${runDirectory}/profile`, { recursive: true, force: true }); }
}
export async function dedicatedLeader({ directory, snapshot, account }) {
  const runDirectory = `${directory}/dedicated-leader`;
  await mkdir(runDirectory, { recursive: true });
  const measured = await launchMeasured({ directory: snapshot, runDirectory });
  try {
    await measured.context.addInitScript(() => { Object.defineProperty(globalThis, 'SharedWorker', { value: undefined, configurable: true }); });
    await prepareReader(measured.context, account);
    const leader = measured.context.pages()[0];
    const start = await signInReadOnly(leader, measured.base, account);
    const follower = await measured.context.newPage();
    await follower.goto(measured.base);
    const second = await firstPaint(follower, 'home', 20000);
    const before = await measured.cdp.sample();
    const originalWorkers = new Set([...measured.cdp.sessions.values()].filter((target) => target.type === 'worker').map((target) => target.targetId));
    const closeAt = Date.now();
    await leader.close();
    let recovered;
    while (Date.now() - closeAt < 60000) {
      const targets = await measured.cdp.sample();
      const replacements = [...measured.cdp.sessions].filter(([, target]) => target.type === 'worker' && !originalWorkers.has(target.targetId));
      for (const [session, target] of replacements) {
        const probe = await measured.cdp.evaluate(session, 'globalThis.__realHourSnapshot?.()', 2000).catch(() => null);
        if (probe?.sockets.some((socket) => socket.readyState === 1 && socket.subscriptions))
          recovered = { elapsedMs: Date.now() - closeAt, newWorkerTarget: target.targetId, originalWorkerTargets: [...originalWorkers], targets };
      }
      if (recovered) break;
      await delay(500);
    }
    return { start, second, before, recovered: recovered ?? { failed: 'no subscribed dedicated worker socket after leader close' }, page: await samplePage(follower) };
  } finally { await measured.close(); await rm(`${runDirectory}/profile`, { recursive: true, force: true }); }
}
