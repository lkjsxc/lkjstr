// Packaged bytes only. Completed shells are immutable; no events, media or keys enter this cache.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Asset = readonly [path: string, sha256: string];
const worker = `
const assets = __ASSETS__;
const build = __BUILD__;
const prefix = 'lkjstr-shell-';
const ownPrefix = prefix + build + '-';
const marker = '/.lkjstr-shell-complete';
const hashes = new Map(assets);
let stage = null;

function locked(work, mode = 'exclusive') {
  if (!self.navigator.locks) throw new Error('shell locking unavailable');
  return self.navigator.locks.request('lkjstr-shell-cache', { mode }, work);
}
function slots() {
  return [self.registration.active, self.registration.waiting, self.registration.installing];
}
self.addEventListener('message', (event) => {
  if (event.data?.k === 'lkjstr-shell-identity')
    event.ports[0]?.postMessage({ build, stage });
});
function identity(worker) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (value) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      value ? resolve(value) : reject(new Error('shell identity unavailable'));
    };
    const timer = setTimeout(() => finish(null), 5000);
    channel.port1.onmessage = ({ data }) => {
      if (!/^[a-f0-9]{24}$/.test(data?.build)
        || (data.stage !== null && !data.stage?.startsWith(prefix + data.build + '-')))
        return finish(null);
      finish(data);
    };
    try { worker.postMessage({ k: 'lkjstr-shell-identity' }, [channel.port2]); }
    catch { finish(null); }
  });
}
async function complete(name) {
  const response = await caches.match(marker, { cacheName: name });
  return response ? response.text() : null;
}
async function prune(ignore, local) {
  // New names are allocated only under this lock. Capture candidates before querying live workers.
  const names = (await caches.keys()).filter((name) => name.startsWith(prefix));
  const before = slots();
  const live = await Promise.all(before.map((worker) =>
    worker && worker !== ignore ? (worker === local ? { build, stage } : identity(worker)) : null));
  if (slots().some((worker, i) => worker !== before[i])) throw new Error('shell lifecycle changed');
  const builds = new Set(live.filter(Boolean).map((id) => id.build));
  const keep = new Set();
  const completed = new Map();
  for (const name of names) {
    const value = await complete(name);
    if (builds.has(value) && name.startsWith(prefix + value + '-') && !completed.has(value)) {
      completed.set(value, name);
      keep.add(name);
    }
  }
  // An incomplete stage is retained only while its actual installer is alive.
  if (live[2]?.stage) keep.add(live[2].stage);
  if (slots().some((worker, i) => worker !== before[i])) throw new Error('shell lifecycle changed');
  await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
  return completed;
}
async function verified(path, signal) {
  const response = await fetch(path, {
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
  });
  if (!response.ok) throw new Error('shell asset unavailable');
  const bytes = await response.clone().arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (v) => v.toString(16).padStart(2, '0')).join('');
  if (digest !== hashes.get(path)) throw new Error('shell asset changed');
  return response;
}
self.addEventListener('install', (event) => {
  const owner = self.registration.installing;
  event.waitUntil((async () => {
    const reserved = await locked(async () => {
      const completed = await prune(owner);
      const existing = completed.get(build);
      if (existing) {
        stage = existing;
        return { reused: true };
      }
      stage = ownPrefix + crypto.randomUUID();
      return { name: stage, cache: await caches.open(stage) };
    });
    if (reserved.reused) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      // Network waits never hold the shared cache lock or delay another build's activation.
      for (let start = 0; start < assets.length; start += 4) {
        const outcomes = await Promise.allSettled(assets.slice(start, start + 4).map(
          async ([path]) => reserved.cache.put(path, await verified(path, controller.signal))));
        const failed = outcomes.find((outcome) => outcome.status === 'rejected');
        if (failed) throw failed.reason;
      }
      await locked(async () => {
        if (self.registration.installing !== owner || !(await caches.has(reserved.name)))
          throw new Error('shell installation retired');
        await reserved.cache.put(marker, new Response(build));
      });
    } catch (error) {
      // The name belongs only to this attempt. A failed rollback cannot erase a viable old shell.
      await locked(() => caches.delete(reserved.name));
      throw error;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  })());
});
let maintenance = null;
let retryMaintenance = 0;
function maintain(owner) {
  if (!owner || Date.now() < retryMaintenance) return Promise.resolve();
  if (!maintenance) maintenance = locked(() => prune(null, owner)).catch(() => {
    // Activation can be interrupted. Retry from a later controlled request without losing caches.
    maintenance = null;
    retryMaintenance = Date.now() + 30000;
  });
  return maintenance;
}
self.addEventListener('activate', (event) => {
  // Default lifecycle waits for all old controlled clients; never skipWaiting or claim a draft.
  event.waitUntil(maintain(self.registration.active));
});
async function cached(path) {
  return locked(async () => {
    for (const name of await caches.keys()) {
      if (!name.startsWith(ownPrefix) || await complete(name) !== build) continue;
      const response = await caches.match(path, { cacheName: name });
      if (response) return response;
    }
    return null;
  }, 'shared');
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Recover cleanup if a browser interrupted activation work.
  event.waitUntil(maintain(self.registration.active));
  const navigation = request.mode === 'navigate'
    && (url.pathname === '/' || new RegExp('^/(?:n|p)/[a-z0-9]+/?$').test(url.pathname));
  const path = navigation ? '/index.html' : url.pathname;
  if (!hashes.has(path)) return;
  event.respondWith((async () => {
    let response;
    try { response = await cached(path); } catch { /* online verification still works */ }
    // Never open/recreate a retired cache. A missing entry cannot bypass the manifest integrity.
    return response || verified(path);
  })());
});
`;

export function shellWorker(assets: readonly Asset[]): string {
  if (assets.length === 0 || assets.length > 64) throw new Error('shell asset count');
  const source = worker.replace('__ASSETS__', JSON.stringify(assets));
  const version = createHash('sha256').update(source).digest('hex').slice(0, 24);
  return source.replace('__BUILD__', JSON.stringify(version));
}

export function buildShellCache(out: string): void {
  const assets = readdirSync(out)
    .filter(
      (name) =>
        name !== 'sw.js' &&
        (/\.(js|css|wasm|png|svg|ico|webmanifest)$/.test(name) ||
          ['index.html', 'privacy.html', 'LICENSE.txt'].includes(name)),
    )
    .sort()
    .map(
      (name): Asset => [
        `/${name}`,
        createHash('sha256')
          .update(readFileSync(join(out, name)))
          .digest('hex'),
      ],
    );
  writeFileSync(join(out, 'sw.js'), shellWorker(assets));
}
