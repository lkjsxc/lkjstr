import { AVATAR_CACHE, AVATAR_FRAGMENT, publicAvatarUrl } from '../src/engine/avatar-cache.ts';

export const avatarWorker = String.raw`
const avatarCacheName = ${JSON.stringify(AVATAR_CACHE)};
const avatarFragment = ${JSON.stringify(AVATAR_FRAGMENT)};
const avatarUrl = ${publicAvatarUrl.toString()};
const avatarLimit = 64;
const avatarByteLimit = 128 * 1024;
const avatarTtlLimit = 60 * 60 * 1000;
const avatarExpiry = 'x-lkjstr-avatar-expires';
const avatarCopyTimeout = 2500;
const avatarCopyLimit = 16;
const avatarCopyAttempts = 3;
const avatarNegativeTtl = 30000;
const avatarLookupTimeout = 500;
// A read index starts during navigation. Misses go straight to the browser's image loader.
const storedAvatars = new Set();
let avatarIndex;
function indexAvatars() {
  return avatarIndex ??= avatarDeadline(async (signal) => {
    if (!(await caches.has(avatarCacheName))) return;
    signal.throwIfAborted();
    const keys = await (await caches.open(avatarCacheName)).keys();
    signal.throwIfAborted();
    for (const key of keys.slice(0, avatarLimit)) storedAvatars.add(key.url);
  }, avatarLookupTimeout).catch(() => { avatarIndex = undefined; });
}

// At most 16 offered copies including the one active low-priority read.
const avatarCopies = new Map();
let activeAvatarCopy = null;
let avatarCopyTimer;
// At most 64 URLs that used all their copy attempts.
const avatarCopyBackoff = new Map();

async function avatarDeadline(work, ms) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(controller.signal.reason);
    }, ms);
  });
  try {
    return await Promise.race([deadline, work(controller.signal)]);
  } finally {
    clearTimeout(timer);
  }
}

function remoteAvatar(value) {
  const url = typeof value === 'string' ? avatarUrl(value) : null;
  return url && url.origin !== self.location.origin ? url.href : null;
}

async function cachedAvatar(url) {
  const hit = await caches.match(url, { cacheName: avatarCacheName });
  if (hit && Number(hit.headers.get(avatarExpiry)) > Date.now()) return hit;
  storedAvatars.delete(url);
  return null;
}

function avatarFreshUntil(headers) {
  const control = headers.get('cache-control') || '';
  const maxAge = /(?:^|,)\s*max-age\s*=\s*"?([0-9]+)"?\s*(?:,|$)/i.exec(control);
  if (!maxAge || /(?:^|,)\s*(?:private|no-cache|no-store)(?:\s*[,=]|\s*$)/i.test(control))
    return 0;
  const now = Date.now();
  const date = Date.parse(headers.get('date') || '');
  const age = Math.max(0, Number(headers.get('age')) * 1000 || 0,
    Number.isFinite(date) ? now - date : 0);
  return now + Math.min(avatarTtlLimit, Number(maxAge[1]) * 1000 - age);
}

async function avatarBytes(response, mime, signal) {
  if (!response.body) return;
  if (Number(response.headers.get('content-length')) > avatarByteLimit) {
    void response.body.cancel().catch(() => {});
    return;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > avatarByteLimit) {
        void reader.cancel().catch(() => {});
        return;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Blob(chunks, { type: mime });
  try {
    const bitmap = await createImageBitmap(bytes, { resizeWidth: 1, resizeHeight: 1 });
    bitmap.close();
    return bytes;
  } catch {
    // An unreadable image is ineligible for a copy.
  }
}

async function copyAvatar(url, signal) {
  if (await cachedAvatar(url)) return;
  signal.throwIfAborted();
  // Reuse a fresh HTTP entry when available. Opaque images still load natively.
  const response = await fetch(url, {
    mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
    priority: 'low', signal,
  });
  signal.throwIfAborted();
  const expires = avatarFreshUntil(response.headers);
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (response.type !== 'cors' || !response.ok || expires <= Date.now() ||
      !/^image\/(?:avif|gif|jpeg|png|webp)$/.test(mime)) {
    void response.body?.cancel().catch(() => {});
    if (response.status === 429 || response.status >= 500) throw new Error('avatar host unavailable');
    return;
  }
  const bytes = await avatarBytes(response, mime, signal);
  signal.throwIfAborted();
  if (!bytes || expires <= Date.now()) return;
  await self.navigator.locks.request(avatarCacheName, { signal }, async () => {
    const cache = await caches.open(avatarCacheName);
    if (await cachedAvatar(url)) return;
    signal.throwIfAborted();
    await cache.delete(url);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - avatarLimit + 1))) {
      signal.throwIfAborted();
      await cache.delete(key);
      storedAvatars.delete(key.url);
    }
    signal.throwIfAborted();
    await cache.put(url, new Response(bytes, {
      headers: { 'content-type': mime, 'cache-control': 'no-store', [avatarExpiry]: String(expires) },
    }));
    storedAvatars.add(url);
  });
}

function retryAvatarCopy(job) {
  if (job.attempts < avatarCopyAttempts) {
    job.readyAt = Date.now() + 1000 * 2 ** (job.attempts - 1);
    avatarCopies.set(job.url, job);
    return;
  }
  avatarCopyBackoff.delete(job.url);
  avatarCopyBackoff.set(job.url, Date.now() + avatarNegativeTtl);
  if (avatarCopyBackoff.size > avatarLimit) avatarCopyBackoff.delete(avatarCopyBackoff.keys().next().value);
  job.finish();
}

function drainAvatarCopies() {
  if (activeAvatarCopy) return;
  clearTimeout(avatarCopyTimer);
  const now = Date.now();
  let next = Infinity;
  let ready;
  for (const job of avatarCopies.values()) {
    if (job.readyAt > now) next = Math.min(next, job.readyAt);
    else if (!ready || (!ready.visible && job.visible)) ready = job;
  }
  if (!ready) {
    if (next < Infinity) avatarCopyTimer = setTimeout(drainAvatarCopies, next - now);
    return;
  }
  avatarCopies.delete(ready.url);
  activeAvatarCopy = ready;
  ready.attempts++;
  avatarDeadline((signal) => copyAvatar(ready.url, signal), avatarCopyTimeout)
    .then(ready.finish, () => retryAvatarCopy(ready))
    .finally(() => { activeAvatarCopy = null; drainAvatarCopies(); });
}

self.addEventListener('message', (event) => {
  if (event.data?.k !== 'lkjstr-avatar-loaded' || event.source?.type !== 'window') return;
  const url = remoteAvatar(event.data.url);
  if (!url || !self.navigator.locks || avatarCopyBackoff.get(url) > Date.now()) return;
  const visible = event.data.visible === true;
  const pending = activeAvatarCopy?.url === url ? activeAvatarCopy : avatarCopies.get(url);
  if (pending) {
    pending.visible ||= visible;
    event.waitUntil(pending.done);
    return;
  }
  if (avatarCopies.size + Number(!!activeAvatarCopy) >= avatarCopyLimit) {
    if (!visible) return;
    const jobs = [...avatarCopies.values()];
    const dropped = jobs.find((job) => !job.visible) || jobs[0];
    avatarCopies.delete(dropped.url);
    dropped.finish();
  }
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  avatarCopies.set(url, { url, visible, attempts: 0, readyAt: 0, finish, done });
  event.waitUntil(done);
  drainAvatarCopies();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode === 'navigate') event.waitUntil(indexAvatars());
  if (request.method !== 'GET' || request.destination !== 'image' || request.mode !== 'no-cors' ||
      !request.url.endsWith(avatarFragment)) return;
  const url = remoteAvatar(request.url.slice(0, -avatarFragment.length));
  if (!url || !storedAvatars.has(url)) return;
  event.respondWith(avatarDeadline(() => cachedAvatar(url), avatarLookupTimeout)
    .catch(() => null).then((hit) => {
      if (hit) return hit;
      const timeout = AbortSignal.timeout(7500);
      return fetch(request, { signal: AbortSignal.any?.([request.signal, timeout]) || timeout });
    }));
});
`;
