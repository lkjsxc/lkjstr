const cancelledName = 'BackgroundTaskCancelled';

export function backgroundTaskCancelledError(
  message = 'background task cancelled',
): Error {
  const error = new Error(message);
  error.name = cancelledName;
  return error;
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw backgroundTaskCancelledError();
}

export function isBackgroundTaskCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === cancelledName;
}
