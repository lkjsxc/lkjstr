export const AVATAR_FRAGMENT = '#lkjstr-avatar-v1';
export const AVATAR_CACHE = 'lkjstr-avatar-v1';

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

const IMAGE_SLOTS = 6;
const IMAGE_TIMEOUT = 8_000;
const RETRY_LIMIT = 30_000;
const PENDING = 'data-avatar-pending';

type AvatarJob = {
  img: HTMLImageElement;
  src: string;
  offer?: (visible: boolean) => void;
  eager: boolean;
  visible: boolean;
  delay: number;
  retryAt: number;
  stopAttempt?: () => void;
};

// At most one scheduled job per connected face. A detached tab can remount the same image later.
const jobs = new Map<HTMLImageElement, AvatarJob>();
const pendingImages = new WeakMap<HTMLImageElement, AvatarJob>();
let activeImages = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let visibility: IntersectionObserver | undefined;
let mounts: MutationObserver | undefined;
let drainQueued = false;

function pauseImage(job: AvatarJob): void {
  job.stopAttempt?.();
  visibility?.unobserve(job.img);
  jobs.delete(job.img);
}

function scheduleImages(): void {
  if (drainQueued) return;
  drainQueued = true;
  queueMicrotask(() => {
    drainQueued = false;
    drainImages();
  });
}

function drainImages(): void {
  clearTimeout(retryTimer);
  if (!jobs.size) {
    visibility?.disconnect();
    visibility = undefined;
    return;
  }
  const now = Date.now();
  const visible: AvatarJob[] = [];
  const eager: AvatarJob[] = [];
  let next = Infinity;
  for (const job of jobs.values()) {
    if (!job.img.isConnected) pauseImage(job);
    else if (!job.stopAttempt && (job.visible || job.eager)) {
      if (job.retryAt > now) next = Math.min(next, job.retryAt);
      else (job.visible ? visible : eager).push(job);
    }
  }
  for (const job of visible) {
    if (activeImages === IMAGE_SLOTS) break;
    startImage(job);
  }
  for (const job of eager) {
    if (activeImages >= 2) break;
    startImage(job);
  }
  if (next < Infinity) retryTimer = setTimeout(drainImages, next - now);
  if (!jobs.size) scheduleImages();
}

function startImage(job: AvatarJob): void {
  const { img } = job;
  activeImages++;
  job.eager = false;
  const stop = () => {
    clearTimeout(timer);
    img.removeEventListener('load', loaded);
    img.removeEventListener('error', failed);
    job.stopAttempt = undefined;
    activeImages--;
  };
  const loaded = () => {
    stop();
    pauseImage(job);
    pendingImages.delete(img);
    img.removeAttribute(PENDING);
    img.style.visibility = '';
    scheduleImages();
    if (img.isConnected) job.offer?.(job.visible);
  };
  const failed = () => {
    job.stopAttempt?.();
    job.retryAt = Date.now() + job.delay;
    job.delay = Math.min(job.delay * 2, RETRY_LIMIT);
    scheduleImages();
  };
  const timer = setTimeout(failed, IMAGE_TIMEOUT);
  job.stopAttempt = () => {
    stop();
    img.removeAttribute('src');
  };
  img.addEventListener('load', loaded);
  img.addEventListener('error', failed);
  // The visibility observer starts lazy faces, so the deadline measures an actual attempt.
  img.loading = 'eager';
  img.src = job.src;
}

function resumeImage(img: HTMLImageElement): void {
  const job = pendingImages.get(img);
  if (!job || !img.isConnected || jobs.has(img)) return;
  jobs.set(img, job);
  job.visible = typeof IntersectionObserver === 'undefined';
  if (!job.visible) {
    visibility ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const pending = jobs.get(entry.target as HTMLImageElement);
        if (pending) pending.visible = entry.isIntersecting;
      }
      scheduleImages();
    });
    visibility.observe(img);
  }
  scheduleImages();
}

export function retryAvatar(img: HTMLImageElement): void {
  const job = pendingImages.get(img);
  if (!job?.retryAt || job.stopAttempt) return;
  job.retryAt = 0;
  job.delay = 1000;
  if (jobs.has(img)) scheduleImages();
}

export function loadAvatar(img: HTMLImageElement, picture: string, cachePublic = false): void {
  if (!/^https?:/i.test(picture)) {
    img.addEventListener('error', () => img.remove(), { once: true });
    img.src = picture;
    return;
  }
  const url = cachePublic && navigator.serviceWorker?.controller && publicAvatarUrl(picture);
  const remote = url && url.origin !== location.origin ? url.href : null;
  const job: AvatarJob = {
    img,
    src: remote ? remote + AVATAR_FRAGMENT : picture,
    offer: remote
      ? (visible) => {
          try {
            navigator.serviceWorker.controller?.postMessage({
              k: 'lkjstr-avatar-loaded',
              url: remote,
              visible,
            });
          } catch {
            // The service worker can retire during a page update.
          }
        }
      : undefined,
    eager: img.loading !== 'lazy',
    visible: false,
    delay: 1000,
    retryAt: 0,
  };
  img.style.visibility = 'hidden';
  img.setAttribute(PENDING, '');
  pendingImages.set(img, job);
  resumeImage(img);

  // One observer for the page. It holds no references to detached views or their images.
  if (!mounts) {
    mounts = new MutationObserver((records) => {
      for (const record of records) {
        if (jobs.size && record.removedNodes.length) scheduleImages();
        for (const node of record.addedNodes) {
          if (!(node instanceof Element) || !node.isConnected) continue;
          if (node instanceof HTMLImageElement) resumeImage(node);
          for (const img of node.querySelectorAll<HTMLImageElement>(`img[${PENDING}]`)) {
            resumeImage(img);
          }
        }
      }
    });
    mounts.observe(document, { childList: true, subtree: true });
  }
}
