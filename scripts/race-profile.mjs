// Profiles are fresh owned public readers. Never import a signing key or the owner's browser data.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, devices } from 'playwright-core';
import { installReadonly } from './race-guard.mjs';
import { observeOpen } from './race-observe.mjs';
import { attachRace } from './race-cdp.mjs';
import { delay } from './real-hour-public.mjs';
export async function openBrowser(profile, { site, mobile = false, observe = true, hostResolverRules, base, relayAllowlist } = {}) {
  if (hostResolverRules && !base) throw Error('The owned route requires the measured app origin for a scoped local-network permission');
  const routePermission = hostResolverRules ? { name: 'local-network-access', origin: new URL(base).origin } : null;
  await mkdir(profile, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.LKJSTR_CHROME ?? process.env.HOME + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    headless: true, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false, serviceWorkers: 'allow', viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 900 },
    ...(mobile ? { userAgent: devices['Pixel 7'].userAgent } : {}),
    deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'en-US', colorScheme: 'dark',
    args: ['--no-sandbox', '--disable-background-networking', '--remote-debugging-port=0',
      ...(hostResolverRules ? ['--host-resolver-rules=' + hostResolverRules] : [])],
  });
  let cdp;
  try {
    if (routePermission) await context.grantPermissions([routePermission.name], { origin: routePermission.origin });
    await context.addInitScript(installReadonly, { relayAllowlist });
    if (observe) await context.addInitScript(observeOpen, { site });
    let endpoint;
    for (let i = 0; i < 50 && !endpoint; i++) {
      const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).trim().split('\n');
      if (path) endpoint = 'ws://127.0.0.1:' + port + path; else await delay(100);
    }
    if (!endpoint) throw Error('Owned Chrome CDP endpoint unavailable');
    cdp = await attachRace(endpoint, mobile);
    const page = context.pages()[0] ?? await context.newPage();
    await delay(50); // Allow CDP target network capture before any measured navigation.
    return { context, page, cdp, routePermission, userAgent: await page.evaluate(() => navigator.userAgent), browserVersion: context.browser()?.version() ?? 'persistent Chromium',
      async close() { try { await context.close(); } finally { await cdp.close(); } } };
  } catch (error) { await context.close().catch(() => {}); await cdp?.close(); throw error; }
}
export async function seedIdentity({ profile, site, base, account, schemaVersion = 2, hostResolverRules, relayAllowlist }) {
  const browser = await openBrowser(profile, { site, observe: false, hostResolverRules, base, relayAllowlist });
  try {
    // A setup-only blank response establishes origin without HTTP/TLS/DNS warming or app execution.
    // This routed context is closed; timed navigations use a new unrestricted context/process.
    await browser.context.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>public identity setup</title>' }));
    await browser.page.goto(base + (site === 'lkjstr' ? '/LICENSE.txt' : '/robots.txt'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await browser.page.evaluate(async ({ site, account, schemaVersion }) => {
      if (site === 'nostter') {
        localStorage.setItem('nostter:login', account.npub);
        return;
      }
      const put = (key, value) => localStorage.setItem('lkjstr:' + key, JSON.stringify(value));
      put('migration', 'owner-audit-1'); put('account', account.pubkey);
      const tile = { type: 'pane', id: 'race-home', tabs: ['home'], active: 'home' };
      put('layout:main', tile); put('layout:guest', { ...tile, tabs: ['global'], active: 'global' });
      await new Promise((done, reject) => {
        const open = indexedDB.open('lkjstr-wasm', schemaVersion);
        open.onupgradeneeded = () => {
          const db = open.result;
          const events = db.createObjectStore('events', { keyPath: 'id' });
          events.createIndex('created_at', 'created_at'); db.createObjectStore('kv');
        };
        open.onerror = () => reject(Error('Fresh public identity store failed'));
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('kv', 'readwrite'), store = tx.objectStore('kv');
          store.put(JSON.stringify({ seen: {}, entries: [{ pubkey: account.pubkey, signer: 'none',
            secret: null, relay_hints: [], remote: null }], active: account.pubkey }), 'engine-accounts');
          if (schemaVersion >= 2) store.put('0', 'engine-accounts-cas-v2');
          tx.oncomplete = () => { db.close(); done(); };
          tx.onerror = tx.onabort = () => { db.close(); reject(Error('Fresh public identity transaction failed')); };
        };
      });
    }, { site, account, schemaVersion });
    const session = await browser.context.newCDPSession(browser.page);
    await session.send('Network.clearBrowserCache'); await session.detach();
    return { seeded: new Date().toISOString(), identityOnly: true, eventRows: 0, schemaVersion: site === 'lkjstr' ? schemaVersion : null };
  } finally { await browser.close(); }
}
export async function readerState(page, site, account) {
  return page.evaluate(async ({ site, account }) => {
    const databases = await indexedDB.databases(), stores = {};
    for (const { name } of databases) {
      if (!['lkjstr-wasm', 'cache'].includes(name)) continue;
      stores[name] = await new Promise((done, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(Error('Public profile inspection failed'));
        open.onsuccess = () => {
          const db = open.result, counts = {}, tx = db.transaction([...db.objectStoreNames]);
          for (const name of db.objectStoreNames) {
            const request = tx.objectStore(name).count(); request.onsuccess = () => { counts[name] = request.result; };
          }
          tx.oncomplete = () => { db.close(); done(counts); };
          tx.onerror = tx.onabort = () => { db.close(); reject(Error('Public profile inspection transaction failed')); };
        };
      });
    }
    let readOnly;
    if (site === 'nostter') readOnly = localStorage.getItem('nostter:login') === account.npub;
    else readOnly = await new Promise((done, reject) => {
      const open = indexedDB.open('lkjstr-wasm');
      open.onerror = () => reject(Error('Account inspection failed'));
      open.onsuccess = () => {
        const db = open.result, request = db.transaction('kv').objectStore('kv').get('engine-accounts');
        request.onsuccess = () => {
          let value;
          try { value = JSON.parse(request.result); } catch { value = null; }
          done(value?.active === account.pubkey && value.entries?.length === 1 &&
            value.entries[0].pubkey === account.pubkey && value.entries[0].signer === 'none' &&
            !value.entries[0].secret && !value.entries[0].encrypted_key && !value.entries[0].remote);
          db.close();
        };
        request.onerror = () => { db.close(); reject(Error('Account inspection failed')); };
      };
    });
    return { readOnly, stores, url: location.href, serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
      serviceWorkerRegistrations: (await navigator.serviceWorker.getRegistrations()).length, cacheNames: await caches.keys(),
      storage: await navigator.storage.estimate() };
  }, { site, account });
}
