import { bech32, accounts } from '../web/scripts/smoke-visitors.mjs';
import { openKeyField } from '../web/scripts/smoke-seed.mjs';
import { delay } from './real-hour-public.mjs';
export async function prepareReader(context, account) {
  await context.addInitScript(({ pubkey, relays }) => {
    if (location.protocol !== 'http:') return;
    const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
    const tile = (id, tabs) => ({ type: 'pane', id, tabs, active: tabs[0] });
    put('lkjstr:migration', 'owner-audit-1');
    put('lkjstr:layout:guest', tile('guest', ['global']));
    put('lkjstr:layout:main', { type: 'split', id: 'root', dir: 'row', sizes: [0.7, 0.3],
      children: [tile('home-pane', ['home']), tile('notifications-pane', ['notifications'])] });
    const entries = relays.map((url) => ({ url, read: true, write: false, search: false }));
    put('lkjstr:relays:', entries); put(`lkjstr:relays:${pubkey}`, entries);
  }, account);
}
export async function firstPaint(page, source, timeoutMs = 90000, startedAt = Date.now()) {
  const start = startedAt, result = { source };
  while (Date.now() - start < timeoutMs) {
    const value = await page.evaluate((source) => {
      const view = document.querySelector(`.view[data-kind="${source}"]`);
      if (!view) return {};
      const note = view.querySelector('.note');
      const name = note?.querySelector('.name')?.textContent ?? '';
      const image = note?.querySelector('.av img');
      return { note: Boolean(note), name: name && !name.startsWith('npub1'), picture: Boolean(image?.complete && image.naturalWidth) };
    }, source);
    const ms = Date.now() - start;
    if (value.note) result.noteMs ??= ms;
    if (value.name) result.nameMs ??= ms;
    if (value.picture) result.pictureMs ??= ms;
    if (result.noteMs !== undefined && result.nameMs !== undefined && result.pictureMs !== undefined) break;
    // Missing image metadata must not delay the hour's start by ninety seconds.
    if (result.noteMs !== undefined && ms > 15000) break;
    await delay(100);
  }
  result.elapsedMs = Date.now() - start;
  return result;
}
export async function signInReadOnly(page, base, account) {
  const navigationStart = Date.now();
  await page.goto(base);
  const guest = await firstPaint(page, 'global', 25000, navigationStart);
  await page.locator('.acct.out').click();
  await openKeyField(page);
  const start = Date.now();
  await page.locator(`${accounts} input`).fill(bech32('npub', account.pubkey));
  await page.locator(`${accounts} input`).press('Enter');
  await page.locator('.acct .ro').waitFor({ timeout: 30000 });
  const home = await firstPaint(page, 'home', 90000, start);
  return { guest, home, timing: 'Global from navigation start; Home from filling/submitting a public npub; 100ms DOM polling, avatar loaded (not a compositor paint timestamp)', readOnly: await page.locator('.acct .ro').count() === 1 };
}
export async function samplePage(page) {
  return page.evaluate(async () => {
    const views = {};
    for (const view of document.querySelectorAll('.view')) {
      const kind = view.dataset.kind;
      views[kind] = { notes: [...view.querySelectorAll('.note')].map((note) => ({ id: note.dataset.note,
        key: note.dataset.key, time: note.querySelector('time')?.getAttribute('datetime') })),
        phase: view.querySelector('.fstate')?.textContent, scrollTop: view.scrollTop, scrollHeight: view.scrollHeight };
    }
    const storage = await navigator.storage.estimate();
    const databases = await indexedDB.databases();
    const events = databases.some((db) => db.name === 'lkjstr-wasm') ? await new Promise((resolve) => {
      const open = indexedDB.open('lkjstr-wasm');
      open.onsuccess = () => { const db = open.result;
        const count = db.transaction('events').objectStore('events').count();
        count.onsuccess = () => { resolve(count.result); db.close(); };
        count.onerror = () => { resolve(null); db.close(); };
      };
      open.onerror = () => resolve(null);
    }) : 0;
    return { at: Date.now(), storage, physicalEvents: events, views, probe: globalThis.__realHourSnapshot?.() };
  });
}
export async function scrollArchive(page, target = 2000, timeoutMs = 240000) {
  const start = Date.now(), seen = new Set(), pages = [];
  let unchanged = 0, lastGrowth = start;
  const arrivals = [];
  while (seen.size < target && Date.now() - start < timeoutMs && unchanged < 75) {
    const before = seen.size;
    const step = Date.now();
    const result = await page.evaluate(() => {
      const view = document.querySelector('.view[data-kind="home"]');
      const ids = [...view.querySelectorAll('.note')].map((note) => note.dataset.note).filter(Boolean);
      view.scrollTop = Math.max(0, view.scrollHeight - view.clientHeight);
      view.dispatchEvent(new Event('scroll'));
      return { ids, height: view.scrollHeight, top: view.scrollTop, phase: view.querySelector('.fstate')?.textContent };
    });
    for (const id of result.ids) seen.add(id);
    if (seen.size > before) {
      if (before > 0) arrivals.push({ added: seen.size - before, observedWaitMs: Date.now() - lastGrowth });
      lastGrowth = Date.now();
    }
    await delay(600);
    unchanged = seen.size === before ? unchanged + 1 : 0;
    pages.push({ elapsedMs: Date.now() - step, total: seen.size, added: seen.size - before, phase: result.phase });
  }
  return { requestedNotes: target, distinctRenderedNotes: seen.size, complete: seen.size >= target,
    elapsedMs: Date.now() - start, idleTailMs: Date.now() - lastGrowth,
    rowArrivals: arrivals, latencyResolution: 'Scroll-to-new-rows observed at 600ms polling resolution; includes intentional poll delay, not raw relay latency',
    pages, ids: [...seen] };
}
export async function returnHomeTop(page) {
  await page.evaluate(() => {
    const view = document.querySelector('.view[data-kind="home"]');
    if (view) { view.querySelector('.fresh')?.click(); view.scrollTop = 0; view.dispatchEvent(new Event('scroll')); }
  });
}
