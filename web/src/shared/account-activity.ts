// Share only bounded activity timestamps, never account identity, typed text or key material.
export type ActivityChannel = Pick<BroadcastChannel, 'postMessage' | 'close' | 'onmessage'>;
export type ActivityOptions = {
  channel?: ActivityChannel | null;
  page?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
  wake?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
};
const CHANNEL = 'lkjstr:account-activity';
const BROADCAST_MS = 250;
function openChannel(): ActivityChannel | undefined {
  try {
    return new BroadcastChannel(CHANNEL);
  } catch {
    return undefined;
  }
}
export function createAccountActivity(
  changed: (activity: boolean) => void,
  options: ActivityOptions = {},
) {
  const page = options.page ?? document;
  const wake = options.wake ?? window;
  const channel = options.channel === undefined ? openChannel() : options.channel;
  let last = Date.now();
  let monotonic = performance.now();
  let known = false;
  let disposed = false;
  let sent = -Infinity;
  let broadcast: ReturnType<typeof setTimeout> | undefined;
  const post = (message: { t: 'activity' | 'probe'; at: number }): void => {
    if (!disposed) {
      try {
        channel?.postMessage(message);
      } catch {
        /* A closing page may lose its port. */
      }
    }
  };
  const publish = (): void => {
    if (disposed || !known || last > Date.now()) return;
    const remaining = BROADCAST_MS - (performance.now() - sent);
    if (remaining > 0) {
      broadcast ??= setTimeout(() => {
        broadcast = undefined;
        publish();
      }, remaining);
      return;
    }
    clearTimeout(broadcast);
    broadcast = undefined;
    sent = performance.now();
    post({ t: 'activity', at: last });
  };
  const probe = (): void => post({ t: 'probe', at: Date.now() });
  if (channel)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (disposed || !event.data || typeof event.data !== 'object') return;
      const value = event.data as { t?: unknown; at?: unknown };
      const now = Date.now();
      if (
        typeof value.at !== 'number' ||
        !Number.isSafeInteger(value.at) ||
        value.at < 0 ||
        value.at > now
      )
        return;
      if (value.t === 'probe') {
        if (now - value.at <= 2000) publish();
      } else if (value.t === 'activity' && (!known || value.at > last)) {
        last = value.at;
        monotonic = performance.now() - (now - last);
        known = true;
        changed(true);
      }
    };
  const activity = (): void => {
    if (disposed || page.hidden) return;
    last = Date.now();
    monotonic = performance.now();
    known = true;
    publish();
    changed(true);
  };
  const resume = (): void => changed(false);
  page.addEventListener('keydown', activity, true);
  page.addEventListener('pointermove', activity, { capture: true, passive: true });
  page.addEventListener('visibilitychange', resume);
  wake.addEventListener('pageshow', resume);
  // A new page learns prior activity without falsely broadcasting its creation as a key press.
  queueMicrotask(() => {
    if (!disposed) probe();
  });
  return {
    elapsed: (): number => Math.max(0, Date.now() - last, performance.now() - monotonic),
    probe,
    dispose() {
      disposed = true;
      clearTimeout(broadcast);
      page.removeEventListener('keydown', activity, true);
      page.removeEventListener('pointermove', activity, true);
      page.removeEventListener('visibilitychange', resume);
      wake.removeEventListener('pageshow', resume);
      if (channel) {
        channel.onmessage = null;
        channel.close();
      }
    },
  };
}
