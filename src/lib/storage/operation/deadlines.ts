export type DeadlineResult<T> =
  | { readonly timedOut: false; readonly value: T }
  | { readonly timedOut: true };

export function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<DeadlineResult<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ timedOut: false, value });
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
