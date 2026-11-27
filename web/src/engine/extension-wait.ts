// NIP-07 injection is a transport wait, not a request to the signer.
export type SignerWait = 'finding' | 'approval' | undefined;
export type ExtensionWait = {
  signal: AbortSignal;
  pressedAt: number;
  expiresAt?: number;
  finding?(on: boolean): void;
};

let loadedAt: number | undefined;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'load',
    () => {
      loadedAt = performance.now();
    },
    { once: true },
  );
}
function pageLoad(): number | undefined {
  if (loadedAt !== undefined) return loadedAt;
  const nav = performance.getEntriesByType?.('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (nav?.loadEventStart) return nav.loadEventStart;
  // Browsers supply navigation timing. This fallback also covers synthetic documents.
  if (document.readyState === 'complete') return 0;
}

export function waitForInjection<T>(lookup: () => T | undefined, wait: ExtensionWait): Promise<T> {
  const { signal, pressedAt, expiresAt, finding } = wait;
  const maximum = Math.min(
    pressedAt + 60_000,
    expiresAt === undefined ? Infinity : expiresAt - performance.timeOrigin,
  );
  if (signal.aborted) return Promise.reject(new Error('cancelled'));
  const first = lookup();
  if (first !== undefined) return Promise.resolve(first);
  finding?.(true);
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (value?: T, error?: string): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      window.removeEventListener('pagehide', cancel);
      finding?.(false);
      if (error) reject(new Error(error));
      else resolve(value!);
    };
    const cancel = (): void => finish(undefined, 'cancelled');
    const poll = (): void => {
      if (signal.aborted) return cancel();
      const now = performance.now();
      const load = pageLoad();
      const deadline = Math.min(
        maximum,
        load === undefined ? Infinity : Math.max(load + 3000, pressedAt + 1000),
      );
      // A late timer must not extend the injection window.
      if (now > deadline) return finish(undefined, 'signer-missing');
      const found = lookup();
      if (found !== undefined) return finish(found);
      if (now >= deadline) return finish(undefined, 'signer-missing');
      timer = setTimeout(poll, Math.min(100, deadline - now));
    };
    signal.addEventListener('abort', cancel, { once: true });
    window.addEventListener('pagehide', cancel, { once: true });
    timer = setTimeout(poll, 100);
  });
}

/** Only an unanswered stage lasting a second is visible. A stage change clears its old words. */
export function createSignerWait(notify: (stage: SignerWait) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown = false;
  return (stage: SignerWait, since = performance.now()): void => {
    clearTimeout(timer);
    if (shown) {
      shown = false;
      notify(undefined);
    }
    if (stage) {
      const show = (): void => {
        shown = true;
        notify(stage);
      };
      const left = 1000 - (performance.now() - since);
      if (left <= 0) show();
      else timer = setTimeout(show, left);
    }
  };
}
