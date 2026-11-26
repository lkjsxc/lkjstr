type Readiness = { get(): unknown; subscribe(fn: (value: unknown) => void): () => void };

// Optional shell caching has no account access and cannot interrupt startup.
const bootController = globalThis.navigator?.serviceWorker?.controller;
const CHECK_INTERVAL_MS = 5 * 60_000;
const CHECK_THROTTLE_MS = 60_000;
const RELOAD_IDLE_MS = 5_000;

export function installShell(hasDraft: () => boolean, notice: () => void, ready: Readiness): void {
  if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return;
  const workers = navigator.serviceWorker;
  let controller = bootController;
  let registration: ServiceWorkerRegistration | undefined;
  let lastCheck = -Infinity;
  let lastActivity = performance.now();
  let pending = false;
  let notified = false;
  let reloading = false;
  let disposed = false;
  let paused = false;
  let registering = false;
  let failures = 0;
  let wake: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let periodic: ReturnType<typeof setInterval> | undefined;
  let disposeReady: (() => void) | undefined;
  let unwatch = (): void => {};
  const active = () => !disposed && !paused && document.visibilityState === 'visible';
  const apply = (): void => {
    clearTimeout(wake);
    if (!pending || !active() || reloading) return;
    const draft = hasDraft();
    if (draft && !notified) {
      notified = true;
      notice();
    }
    const editing = document.activeElement?.matches(
      'textarea, input:not([type="checkbox"], [type="radio"], [type="button"]), [contenteditable="true"]',
    );
    const remaining = RELOAD_IDLE_MS - (performance.now() - lastActivity);
    if (draft || editing || remaining > 0) {
      wake = setTimeout(apply, draft || editing ? RELOAD_IDLE_MS : remaining);
      return;
    }
    reloading = true;
    location.reload();
  };
  const activated = (): void => {
    if (disposed) return;
    const next = workers.controller;
    if (!next || next === controller) return;
    pending ||= Boolean(controller); // A first installation leaves the current document in place.
    controller = next;
    failures = 0;
    apply();
  };
  const retryLater = (): void => {
    if (disposed) return;
    failures = Math.min(failures + 1, 6);
    clearTimeout(retry);
    retry = undefined;
    if (active()) retry = setTimeout(register, Math.min(1000 * 2 ** (failures - 1), 30_000));
  };
  const watch = (registered: ServiceWorkerRegistration): void => {
    unwatch();
    let installing: ServiceWorker | null = null;
    const offer = (): void => {
      if (!disposed) registered.waiting?.postMessage({ k: 'lkjstr-shell-takeover' });
    };
    const failed = (): void => {
      if (disposed || registration !== registered || registered.active || registered.waiting)
        return;
      registration = undefined;
      unwatch();
      unwatch = () => {};
      retryLater();
    };
    const changed = (): void => {
      if (disposed || registration !== registered) return;
      offer();
      if (installing?.state === 'installed' || installing?.state === 'activated') failures = 0;
      if (installing?.state === 'activated') controller ??= registered.active;
      if (
        installing?.state === 'redundant' &&
        (!registered.installing || registered.installing === installing)
      )
        failed();
    };
    const updated = (): void => {
      installing?.removeEventListener('statechange', changed);
      installing = registered.installing;
      installing?.addEventListener('statechange', changed);
      changed();
      if (!registered.active && !registered.waiting && !registered.installing) failed();
    };
    registered.addEventListener('updatefound', updated);
    unwatch = () => {
      registered.removeEventListener('updatefound', updated);
      installing?.removeEventListener('statechange', changed);
    };
    updated();
    if (registered.active || registered.waiting) failures = 0;
  };
  const register = (): void => {
    if (registration || registering || !active() || (!bootController && !ready.get())) return;
    clearTimeout(retry);
    retry = undefined;
    registering = true;
    void workers
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registered) => {
        if (disposed) return;
        registration = registered;
        // register() already checks the script: do not immediately download it again.
        lastCheck = performance.now();
        controller ??= registered.active;
        watch(registered);
      })
      .catch(retryLater)
      .finally(() => {
        registering = false;
      });
  };
  const check = (): void => {
    if (
      !registration ||
      (!registration.active && !registration.waiting) ||
      !active() ||
      performance.now() - lastCheck < CHECK_THROTTLE_MS
    )
      return;
    lastCheck = performance.now();
    void registration.update().catch(() => {});
  };
  const resume = (): void => {
    if (!active()) {
      clearTimeout(retry);
      retry = undefined;
      return;
    }
    if (registration) check();
    else register();
    apply();
  };
  const activity = (event: Event): void => {
    if (event.type === 'pointermove' && !(event as PointerEvent).buttons) return;
    lastActivity = performance.now();
  };
  const activities = ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel'];
  const start = (): void => {
    if (disposed) return;
    paused = false;
    periodic ??= setInterval(resume, CHECK_INTERVAL_MS);
    resume();
  };
  const hide = (event: PageTransitionEvent): void => {
    paused = true;
    clearInterval(periodic);
    clearTimeout(wake);
    clearTimeout(retry);
    periodic = undefined;
    retry = undefined;
    if (event.persisted) return;
    disposed = true;
    disposeReady?.();
    unwatch();
    for (const type of activities) window.removeEventListener(type, activity, true);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('pageshow', start);
    window.removeEventListener('pagehide', hide);
    workers.removeEventListener('controllerchange', activated);
  };
  for (const type of activities)
    window.addEventListener(type, activity, { capture: true, passive: true });
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', hide);
  workers.addEventListener('controllerchange', activated);
  // One unresolved ready observer per page, even across repeated registration failures.
  void workers.ready.then((ready) => {
    if (!disposed) controller ??= ready.active;
  });
  // Controlled clients can discover repair updates even if their old engine never becomes ready.
  if (!bootController && !ready.get())
    disposeReady = ready.subscribe((value) => {
      if (!value) return;
      disposeReady?.();
      disposeReady = undefined;
      register();
    });
  activated();
  start();
}
