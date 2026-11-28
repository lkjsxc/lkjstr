import {
  beginImageObservation,
  type ImageContext,
  type ImageOutcome,
} from './media-observation.ts';

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

type ImageWait = (ok: boolean) => void;
export type ImageRelease = (handoff?: boolean) => void;
const REDRAW_HANDOFF_MS = 100;
type ImageAttempt = {
  img: HTMLImageElement;
  wait: Set<ImageWait>;
  abort: ImageRelease;
};
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
  observation?: ImageContext,
): ImageRelease {
  const src = mediaSource(value);
  if (src) return assignImage(img, src, onError, timeout, observation);
  onError();
  return () => {};
}

function assignImage(
  img: HTMLImageElement,
  src: string,
  onError: () => void,
  timeout?: number,
  observation?: ImageContext,
): ImageRelease {
  const key = requestKey(src);
  const shared = src.startsWith('http');
  const pending = shared ? images.get(key)?.deref() : undefined;
  if (pending) {
    let release: ImageRelease | undefined;
    const next: ImageWait = (ok) => {
      if (ok) release = assignImage(img, src, onError, timeout, observation);
      else onError();
    };
    pending.wait.add(next);
    // A duplicate in another tile can be visible while the original lazy image is offscreen.
    pending.img.loading = 'eager';
    return (handoff) => {
      if (pending.wait.delete(next) && !pending.wait.size) pending.abort(handoff);
      release?.(handoff);
    };
  }
  const owner: ImageWait = (ok) => {
    if (!ok) onError();
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unowned: ReturnType<typeof setTimeout> | undefined;
  const attempt: ImageAttempt = {
    img,
    wait: new Set([owner]),
    abort(handoff) {
      if (!handoff || !shared) return detach();
      // A row redraw can replace every consumer before its new boxes get observed.
      clearTimeout(unowned);
      unowned = setTimeout(() => {
        if (!attempt.wait.size) detach();
      }, REDRAW_HANDOFF_MS);
    },
  };
  const observe = beginImageObservation(img, src, observation);
  const detach = (): void => {
    observe('cancelled');
    clearTimeout(timer);
    clearTimeout(unowned);
    img.removeEventListener('load', loaded);
    img.removeEventListener('error', rejected);
    if (shared) {
      images.delete(key);
      collected.unregister(attempt);
    }
    if (!attempt.wait.has(owner)) img.removeAttribute('src');
  };
  const finish = (ok: boolean, outcome: ImageOutcome): void => {
    observe(outcome);
    detach();
    if (!ok) {
      img.removeAttribute('src');
      failed.add(key);
    }
    for (const next of attempt.wait) next(ok);
    attempt.wait.clear();
  };
  const loaded = () => finish(true, 'ok');
  const rejected = () => finish(false, 'network_error');
  if (shared) {
    images.set(key, new WeakRef(attempt));
    collected.register(attempt, key, attempt);
  }
  img.addEventListener('load', loaded);
  img.addEventListener('error', rejected);
  if (timeout !== undefined) timer = setTimeout(() => finish(false, 'timeout'), timeout);
  img.src = src;
  return (handoff) => {
    const removed = attempt.wait.delete(owner);
    if (removed && !attempt.wait.size) attempt.abort(handoff);
    if (!removed) img.removeAttribute('src');
  };
}

/** Native audio and video retain range requests and their existing preload policies. */
export function loadPlayable(
  el: HTMLMediaElement,
  value: string,
  onError: () => void,
  observation?: ImageContext,
): boolean {
  const src = mediaSource(value);
  if (!src) return false;
  // Metadata is a native browser completion boundary, not the end of all range requests.
  if (observation) {
    const finish = beginImageObservation(el, src, observation);
    el.addEventListener('loadedmetadata', () => finish('ok'), { once: true });
    el.addEventListener('error', () => finish('network_error'), { once: true });
  }
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
