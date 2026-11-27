import type { SignerWeight } from './protocol.ts';

// One page owns the physical slot for calls into window.nostr. The Worker owns the operation and its result.
export const EXTENSION_DEADLINE_MS = 60_000;
export const BACKGROUND_INTERVAL_MS = 2000;
const CANCELLED = 'cancelled';
const TIMEOUT = 'signer-timeout';

export type ExtensionCall = <T>(method: () => Promise<T>, before?: () => void) => Promise<T>;
type Job = {
  weight: SignerWeight;
  stop(reason: string): void;
  next?: Call;
  started: boolean;
};
type Call = { job: Job; start(): void };

export function createSignerOrchestrator() {
  // Up to 64 actions, 16 private requests and headroom for Worker-owned relay authentication.
  const jobs = new Set<Job>();
  let active: Call | undefined;
  let backgroundAt = -Infinity;
  let backgroundWake: ReturnType<typeof setTimeout> | undefined;
  const background = (job: Job): boolean => job.weight <= 2;
  const latencies: number[] = []; // the last 20 settled extension methods
  let latencyAt = 0;
  let timeouts = 0;
  // One bucket per second. A bucket's timestamp makes pagination and idle time allocation-free.
  const starts = Array.from({ length: 60 }, () => ({ at: -60, count: 0 }));
  const second = (): number => Math.floor(performance.now() / 1000);
  const pump = (): void => {
    clearTimeout(backgroundWake);
    if (active) return;
    // Keep FIFO within a priority. A higher-priority job can run between two methods.
    let next: Job | undefined;
    let deferred = false;
    const wait = backgroundAt - performance.now();
    for (const job of jobs) {
      if (!job.started && background(job) && wait > 0) {
        deferred ||= job.next !== undefined;
      } else if (!next || job.weight > next.weight) {
        next = job;
      }
    }
    if (!next?.next) {
      if (deferred) backgroundWake = setTimeout(pump, Math.ceil(wait));
      return;
    }
    active = next.next;
    next.next = undefined;
    active.start();
  };
  const schedule = (): void => queueMicrotask(pump);
  return {
    run<T>(
      weight: SignerWeight,
      operation: (call: ExtensionCall) => Promise<T>,
      signal?: AbortSignal,
      expiresAt?: number,
    ): Promise<T> {
      if (signal?.aborted) return Promise.reject(new Error(CANCELLED));
      if (jobs.size >= 128) return Promise.reject(new Error('too-large'));
      const received = performance.now();
      const localDeadline = received + EXTENSION_DEADLINE_MS;
      const deadline =
        expiresAt === undefined
          ? localDeadline
          : Math.min(localDeadline, expiresAt - performance.timeOrigin);
      return new Promise<T>((resolve, reject) => {
        let stopped: string | undefined;
        let rejectCall: ((error: Error) => void) | undefined;
        const release = (call: Call): void => {
          if (active !== call) return;
          active = undefined;
          if (stopped) clearTimeout(timer);
          schedule();
        };
        const settle = (): void => {
          jobs.delete(job);
          signal?.removeEventListener('abort', abort);
          if (active?.job !== job) clearTimeout(timer);
        };
        const job: Job = {
          weight,
          started: false,
          stop(reason) {
            if (!jobs.has(job)) return;
            stopped = reason;
            if (reason === TIMEOUT) timeouts++;
            job.next = undefined;
            const error = new Error(reason);
            rejectCall?.(error);
            rejectCall = undefined;
            settle();
            reject(error);
            schedule();
          },
        };
        const abort = (): void =>
          job.stop(
            signal?.reason === TIMEOUT || performance.now() >= deadline ? TIMEOUT : CANCELLED,
          );
        // NIP-07 gives the page no way to abort an open prompt. Keep its slot until it settles
        // or its original deadline passes. Cancellation still settles the owner immediately.
        const timer = setTimeout(
          () => {
            job.stop(TIMEOUT);
            if (active?.job === job) release(active);
          },
          Math.max(0, deadline - received),
        );
        jobs.add(job);
        signal?.addEventListener('abort', abort, { once: true });
        const call: ExtensionCall = (method, before) =>
          new Promise((answer, failure) => {
            if (stopped) return failure(new Error(stopped));
            rejectCall = failure;
            const item: Call = {
              job,
              start() {
                let at: number | undefined;
                const finish = (): void => {
                  const end = performance.now();
                  if (end >= deadline) job.stop(TIMEOUT);
                  if (active === item && end < deadline && at !== undefined) {
                    latencies[latencyAt] = end - at;
                    latencyAt = (latencyAt + 1) % 20;
                  }
                  rejectCall = undefined;
                  release(item);
                };
                if (performance.now() >= deadline) {
                  job.stop(TIMEOUT);
                  release(item);
                  return;
                }
                try {
                  before?.();
                  at = performance.now();
                  if (!job.started && background(job)) backgroundAt = at + BACKGROUND_INTERVAL_MS;
                  job.started = true;
                  const s = second();
                  const bucket = starts[s % starts.length]!;
                  if (bucket.at !== s) (bucket.at = s), (bucket.count = 0);
                  bucket.count++;
                  void Promise.resolve(method()).then(
                    (value) => {
                      finish();
                      answer(value);
                    },
                    (error) => {
                      finish();
                      failure(error);
                    },
                  );
                } catch (error) {
                  finish();
                  failure(error);
                }
              },
            };
            job.next = item;
            schedule();
          });
        void operation(call).then(
          (value) => {
            settle();
            resolve(value);
            schedule();
          },
          (error) => {
            settle();
            reject(error);
            schedule();
          },
        );
      });
    },
    reset(): void {
      for (const job of jobs) job.stop(CANCELLED);
    },
    stats() {
      const now = second();
      const ordered = [...latencies].sort((a, b) => a - b);
      const upper = ordered[Math.floor(ordered.length / 2)];
      const lower = ordered[Math.floor((ordered.length - 1) / 2)];
      return {
        pending: jobs.size + Number(active !== undefined && !jobs.has(active.job)),
        latencyMs: upper === undefined || lower === undefined ? null : (upper + lower) / 2,
        callsPerMinute: starts.reduce(
          (sum, entry) => sum + (now - entry.at < 60 ? entry.count : 0),
          0,
        ),
        timeouts,
      };
    },
  };
}

export type SignerOrchestrator = ReturnType<typeof createSignerOrchestrator>;
