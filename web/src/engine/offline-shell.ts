// Optional shell caching has no account access and cannot interrupt startup.
export function installShell(): void {
  if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return;
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .catch(() => {
      // Storage-disabled browsers keep the online application.
    });
}
