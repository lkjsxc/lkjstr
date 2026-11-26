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
  let wake: ReturnType<typeof setTimeout> | undefined;
  let periodic: ReturnType<typeof setInterval> | undefined;
  const visible = () => document.visibilityState === 'visible';
  const apply = (): void => {
    clearTimeout(wake);
    if (!pending || !visible() || reloading) return;
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
    const next = workers.controller;
    if (!next || next === controller) return;
    pending ||= Boolean(controller); // A first installation leaves the current document in place.
    controller = next;
    apply();
  };
  const check = (): void => {
    if (!registration || !visible() || performance.now() - lastCheck < CHECK_THROTTLE_MS) return;
    lastCheck = performance.now();
    void registration.update().catch(() => {});
  };
  const resume = (): void => {
    check();
    apply();
  };
  const activity = (event: Event): void => {
    if (event.type === 'pointermove' && !(event as PointerEvent).buttons) return;
    lastActivity = performance.now();
  };
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel'])
    window.addEventListener(type, activity, { capture: true, passive: true });
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('online', check);
  const start = (): void => {
    periodic ??= setInterval(resume, CHECK_INTERVAL_MS);
    resume();
  };
  window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', () => {
    clearInterval(periodic);
    clearTimeout(wake);
    periodic = undefined;
  });
  workers.addEventListener('controllerchange', activated);
  activated();
  start();
  const register = (): void => {
    void workers
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registered) => {
        registration = registered;
        // The first worker may leave this page uncontrolled until its next navigation.
        controller ??= registered.active;
        void workers.ready.then((ready) => {
          controller ??= ready.active;
        });
        const offer = (): void => {
          registered.waiting?.postMessage({ k: 'lkjstr-shell-takeover' });
        };
        registered.addEventListener('updatefound', () => {
          registered.installing?.addEventListener('statechange', offer);
        });
        registered.installing?.addEventListener('statechange', offer);
        offer();
        check();
      })
      .catch(() => {});
  };
  // Existing controlled clients must still discover updates if their old engine fails to boot.
  if (bootController || ready.get()) register();
  else {
    const dispose = ready.subscribe((value) => {
      if (!value) return;
      dispose();
      window.removeEventListener('pagehide', abandoned);
      register();
    });
    const abandoned = (event: PageTransitionEvent): void => {
      if (!event.persisted) {
        dispose();
        window.removeEventListener('pagehide', abandoned);
      }
    };
    window.addEventListener('pagehide', abandoned);
  }
}
