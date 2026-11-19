// Optional shell caching has no account access and cannot interrupt startup.
const bootController = globalThis.navigator?.serviceWorker?.controller;

export function installShell(hasDraft: () => boolean, notice: () => void): void {
  if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return;
  const workers = navigator.serviceWorker;
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const reloaded = navigation?.type === 'reload';
  let handled = false;
  const activated = (): void => {
    if (!bootController || !workers.controller || workers.controller === bootController || handled)
      return;
    handled = true;
    if (reloaded && !hasDraft()) location.reload();
    else notice();
  };
  workers.addEventListener('controllerchange', activated);
  activated();
  void workers
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((registration) => {
      const offer = (): void => {
        registration.waiting?.postMessage({ k: 'lkjstr-shell-takeover' });
      };
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', offer);
      });
      registration.installing?.addEventListener('statechange', offer);
      offer();
      if (reloaded) void registration.update().catch(() => {});
    })
    .catch(() => {});
}
