export const AVATAR_FRAGMENT = '#lkjstr-avatar-v1';
export const AVATAR_CACHE = 'lkjstr-avatar-v1';

const offeredUrls = new Set<string>(); // At most 64; duplicate tiles offer one copy per page.

/** Public profile pictures eligible for the optional, anonymous copy. */
export function publicAvatarUrl(value: string): URL | null {
  if (value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.href.includes('?') ||
    url.href.includes('#')
  )
    return null;
  return url;
}

export function loadPublicAvatar(img: HTMLImageElement, picture: string): void {
  const worker = navigator.serviceWorker?.controller;
  const url = worker && publicAvatarUrl(picture);
  if (!url || url.origin === location.origin) {
    img.src = picture;
    return;
  }
  img.addEventListener(
    'load',
    () => {
      if (!img.isConnected || offeredUrls.has(url.href)) return;
      offeredUrls.add(url.href);
      if (offeredUrls.size > 64) offeredUrls.delete(offeredUrls.values().next().value ?? '');
      // Browsers that omit the fragment from worker requests still use the native image path.
      worker.postMessage({ k: 'lkjstr-avatar-loaded', url: url.href });
    },
    { once: true },
  );
  img.src = url.href + AVATAR_FRAGMENT;
}
