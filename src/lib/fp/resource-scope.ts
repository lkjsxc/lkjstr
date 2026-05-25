export type ResourceScope = ReturnType<typeof createResourceScope>;

export function createResourceScope(debugName?: string) {
  const cleanups: (() => void)[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const listeners = new Set<{
    readonly target: EventTarget;
    readonly type: string;
    readonly fn: EventListener;
  }>();
  const subs = new Set<() => void>();
  const workers = new Set<Worker>();
  let closed = false;

  const ensureOpen = (): void => {
    if (closed) throw new Error(`Scope ${debugName ?? ''} already closed`);
  };

  const add = (cleanup: () => void): void => {
    if (closed) {
      cleanup();
      return;
    }
    cleanups.push(cleanup);
  };

  const timer = (
    fn: () => void,
    ms: number,
  ): ReturnType<typeof setTimeout> => {
    ensureOpen();
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const interval = (
    fn: () => void,
    ms: number,
  ): ReturnType<typeof setInterval> => {
    ensureOpen();
    const id = setInterval(fn, ms);
    intervals.add(id);
    return id;
  };

  const eventListener = (
    target: EventTarget,
    type: string,
    fn: EventListener,
    options?: AddEventListenerOptions,
  ): void => {
    ensureOpen();
    target.addEventListener(type, fn, options);
    const entry = { target, type, fn };
    listeners.add(entry);
    add(() => {
      listeners.delete(entry);
      target.removeEventListener(type, fn, options);
    });
  };

  const storeSub = (unsubscribe: () => void): void => {
    ensureOpen();
    subs.add(unsubscribe);
    add(() => {
      subs.delete(unsubscribe);
      unsubscribe();
    });
  };

  const worker = (w: Worker): void => {
    ensureOpen();
    workers.add(w);
    add(() => {
      workers.delete(w);
      w.terminate();
    });
  };

  const abortListener = (
    signal: AbortSignal,
    fn: () => void,
  ): void => {
    ensureOpen();
    signal.addEventListener('abort', fn, { once: true });
    add(() => signal.removeEventListener('abort', fn));
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const id of intervals) clearInterval(id);
    intervals.clear();
    for (const { target, type, fn } of listeners)
      target.removeEventListener(type, fn);
    listeners.clear();
    for (const unsubscribe of subs) unsubscribe();
    subs.clear();
    for (const w of workers) w.terminate();
    workers.clear();
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try {
        cleanups[i]!();
      } catch {
        // ignore cleanup errors
      }
    }
    cleanups.length = 0;
  };

  const isClosed = (): boolean => closed;

  return {
    add,
    timer,
    interval,
    eventListener,
    storeSub,
    worker,
    abortListener,
    close,
    isClosed,
  };
}
