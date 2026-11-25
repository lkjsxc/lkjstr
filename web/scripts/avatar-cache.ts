import { AVATAR_CACHE, AVATAR_FRAGMENT, publicAvatarUrl } from '../src/engine/avatar-cache.ts';

export const avatarWorker = String.raw`
const avatarCacheName = ${JSON.stringify(AVATAR_CACHE)};
const avatarFragment = ${JSON.stringify(AVATAR_FRAGMENT)};
const avatarUrl = ${publicAvatarUrl.toString()};
const avatarLimit = 64;
const avatarByteLimit = 128 * 1024;
const avatarTtlLimit = 60 * 60 * 1000;
const avatarExpiry = 'x-lkjstr-avatar-expires';
// A read index starts during navigation. Misses go straight to the browser's image loader.
const storedAvatars = new Set();
let avatarIndex;
function indexAvatars() {
  return avatarIndex ??= (async () => {
    if (!(await caches.has(avatarCacheName))) return;
    const keys = await (await caches.open(avatarCacheName)).keys();
    for (const key of keys.slice(0, avatarLimit)) storedAvatars.add(key.url);
  })().catch(() => { avatarIndex = undefined; });
}

// At most 16 pending copies, with one low-priority network read at a time.
const avatarCopies = new Set();
let avatarCopyTail = Promise.resolve();
// At most 64 recently unreadable origins. Direct images still use the browser's HTTP cache.
const unreadableAvatars = new Map();

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

async function avatarBytes(response, mime) {
  if (!response.body) return;
  if (Number(response.headers.get('content-length')) > avatarByteLimit) {
    await response.body.cancel();
    return;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > avatarByteLimit) {
      await reader.cancel();
      return;
    }
    chunks.push(value);
  }
  const bytes = new Blob(chunks, { type: mime });
  const bitmap = await createImageBitmap(bytes, { resizeWidth: 1, resizeHeight: 1 });
  bitmap.close();
  return bytes;
}

async function copyAvatar(url) {
  if (await cachedAvatar(url)) return;
  const origin = new URL(url).origin;
  if (unreadableAvatars.get(origin) > Date.now()) return;
  // Reuse a fresh HTTP entry when available. Opaque images still load natively.
  let response;
  try {
    response = await fetch(url, {
      mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
      priority: 'low', signal: AbortSignal.timeout(2500),
    });
  } catch {
    unreadableAvatars.delete(origin);
    unreadableAvatars.set(origin, Date.now() + 60000);
    if (unreadableAvatars.size > 64) unreadableAvatars.delete(unreadableAvatars.keys().next().value);
    return;
  }
  const expires = avatarFreshUntil(response.headers);
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (response.type !== 'cors' || !response.ok || expires <= Date.now() ||
      !/^image\/(?:avif|gif|jpeg|png|webp)$/.test(mime)) {
    await response.body?.cancel();
    return;
  }
  const bytes = await avatarBytes(response, mime);
  if (!bytes || expires <= Date.now()) return;
  await self.navigator.locks.request(avatarCacheName, async () => {
    const cache = await caches.open(avatarCacheName);
    if (await cachedAvatar(url)) return;
    await cache.delete(url);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - avatarLimit + 1))) {
      await cache.delete(key);
      storedAvatars.delete(key.url);
    }
    await cache.put(url, new Response(bytes, {
      headers: { 'content-type': mime, 'cache-control': 'no-store', [avatarExpiry]: String(expires) },
    }));
    storedAvatars.add(url);
  });
}

self.addEventListener('message', (event) => {
  if (event.data?.k !== 'lkjstr-avatar-loaded' || event.source?.type !== 'window') return;
  const url = remoteAvatar(event.data.url);
  if (!url || !self.navigator.locks || avatarCopies.size >= 16 || avatarCopies.has(url)) return;
  avatarCopies.add(url);
  const copy = avatarCopyTail.then(() => copyAvatar(url)).catch(() => {});
  avatarCopyTail = copy.finally(() => avatarCopies.delete(url));
  event.waitUntil(avatarCopyTail);
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode === 'navigate') event.waitUntil(indexAvatars());
  if (request.method !== 'GET' || request.destination !== 'image' || request.mode !== 'no-cors' ||
      !request.url.endsWith(avatarFragment)) return;
  const url = remoteAvatar(request.url.slice(0, -avatarFragment.length));
  if (!url || !storedAvatars.has(url)) return;
  event.respondWith(cachedAvatar(url).catch(() => null).then((hit) => hit || fetch(request)));
});
`;
