import { throwIfAborted } from './cancellation';

type IdleDeadline = {
  readonly didTimeout: boolean;
  timeRemaining: () => number;
};
type IdleCallback = (deadline: IdleDeadline) => void;
type IdleWindow = typeof globalThis & {
  requestIdleCallback?: (
    callback: IdleCallback,
    options?: { timeout: number },
  ) => number;
};

export async function backgroundYield(signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await idleYield();
  throwIfAborted(signal);
}

function idleYield(): Promise<void> {
  const host = globalThis as IdleWindow;
  if (host.requestIdleCallback) {
    return new Promise((resolve) => {
      host.requestIdleCallback?.(() => resolve(), { timeout: 50 });
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
