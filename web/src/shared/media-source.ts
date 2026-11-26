// Normalize rendered media only. Links keep the address that was published.
function publicHost(hostname: string): boolean {
  const host = hostname.replace(/\.$/, '');
  // URL canonicalizes abbreviated, octal, hexadecimal and integer IPv4 literals.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a = 0, b = 0, c = 0] = host.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  // Global unicast only. This also excludes mapped IPv4, loopback and link-local literals.
  if (host.startsWith('['))
    return /^\[[23][0-9a-f]{3}:/.test(host) && !/^\[(?:2001:db8:|3fff:)/.test(host);
  return (
    host.includes('.') &&
    host !== 'home.arpa' &&
    !/\.(localhost|onion|i2p|local|home\.arpa)$/.test(host)
  );
}

function renderUrl(value: string): URL | undefined {
  if (!value.trim()) return;
  let url: URL;
  try {
    url = new URL(value, location.href);
  } catch {
    return;
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:') return url;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.username || url.password) return;
  // Relative app assets are served by the app itself, including on the local dev server.
  if (url.origin === location.origin && !/^(?:[a-z][\w+.-]*:|[/\\]{2})/i.test(value.trim()))
    return url;
  if (!publicHost(url.hostname)) return;
  url.protocol = 'https:';
  return url;
}

function requestKey(src: string): string {
  return src.startsWith('http') ? src.replace(/#.*$/, '') : src;
}

// One entry per distinct failed request in this page's lifetime. Eviction would re-enable retries.
const failed = new Set<string>();

export function mediaHost(value: string): string {
  return URL.canParse(value, location.href) ? new URL(value, location.href).host : '';
}

export function mediaSource(value: string): string | undefined {
  const src = renderUrl(value)?.href;
  return src && !failed.has(requestKey(src)) ? src : undefined;
}

type ImageAttempt = { img: HTMLImageElement; wait: ((ok: boolean) => void)[] };
// Bound by in-flight image URLs. A detached lazy image can be collected before it starts.
const images = new Map<string, WeakRef<ImageAttempt>>();
const collected = new FinalizationRegistry<string>((key) => {
  if (!images.get(key)?.deref()) images.delete(key);
});

/** Let one native image try the URL before concurrent consumers assign it. */
export function loadImage(
  img: HTMLImageElement,
  value: string,
  onError: () => void,
  timeout?: number,
): void {
  const src = mediaSource(value);
  if (!src) {
    onError();
    return;
  }
  if (!src.startsWith('http')) {
    img.addEventListener(
      'error',
      () => {
        failed.add(requestKey(src));
        onError();
      },
      { once: true },
    );
    img.src = src;
    return;
  }
  assignImage(img, src, onError, timeout);
}

function assignImage(
  img: HTMLImageElement,
  src: string,
  onError: () => void,
  timeout?: number,
): void {
  const key = requestKey(src);
  if (failed.has(key)) return onError();
  const pending = images.get(key)?.deref();
  if (pending) {
    pending.wait.push((ok) => {
      if (ok) assignImage(img, src, onError, timeout);
      else onError();
    });
    // A duplicate in another tile can be visible while the original lazy image is offscreen.
    pending.img.loading = 'eager';
    return;
  }
  const attempt: ImageAttempt = { img, wait: [] };
  images.set(key, new WeakRef(attempt));
  collected.register(attempt, key, attempt);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (ok: boolean): void => {
    clearTimeout(timer);
    img.removeEventListener('load', loaded);
    img.removeEventListener('error', rejected);
    images.delete(key);
    collected.unregister(attempt);
    if (!ok) {
      failed.add(key);
      onError();
    }
    for (const next of attempt.wait) next(ok);
  };
  const loaded = () => finish(true);
  const rejected = () => finish(false);
  img.addEventListener('load', loaded);
  img.addEventListener('error', rejected);
  if (timeout !== undefined) timer = setTimeout(rejected, timeout);
  img.src = src;
}

/** Native audio and video retain range requests and their existing preload policies. */
export function loadPlayable(el: HTMLMediaElement, value: string, onError: () => void): boolean {
  const src = mediaSource(value);
  if (!src) return false;
  el.addEventListener(
    'error',
    () => {
      if (el.getAttribute('src') !== src) return;
      failed.add(requestKey(src));
      onError();
    },
    { once: true },
  );
  el.src = src;
  return true;
}
