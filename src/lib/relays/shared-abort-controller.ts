export type SharedAbortController = ReturnType<
  typeof createSharedAbortController
>;

export function createSharedAbortController() {
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];
  const attachSignal = (signal: AbortSignal | undefined): void => {
    if (!signal) return;
    const abort = () => controller.abort();
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    cleanups.push(() => signal.removeEventListener('abort', abort));
  };
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    attachSignal,
    detachSignals: (): void => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}
