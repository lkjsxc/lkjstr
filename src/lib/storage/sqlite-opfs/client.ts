import type { StorageOp, StorageRequest, StorageResponse } from './types';

type PendingRequest = {
  readonly resolve: (response: StorageResponse) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly abort: (() => void) | undefined;
};

export type SqliteOpfsClient = ReturnType<typeof createSqliteOpfsClient>;

export type SqliteOpfsClientOptions = {
  readonly workerFactory?: () => Worker;
  readonly requestPrefix?: string;
};

export function createSqliteOpfsClient(options: SqliteOpfsClientOptions = {}) {
  const worker = (options.workerFactory ?? defaultWorkerFactory)();
  const pending = new Map<string, PendingRequest>();
  const prefix = options.requestPrefix ?? 'sqlite';
  let closed = false;
  let nextId = 0;
  let lateSettled = 0;
  let lateRejected = 0;

  worker.onmessage = (event: MessageEvent<StorageResponse>) => {
    const response = event.data;
    const entry = pending.get(response.requestId);
    if (!entry) {
      lateSettled += 1;
      return;
    }
    pending.delete(response.requestId);
    clearTimeout(entry.timer);
    entry.abort?.();
    entry.resolve(response);
  };

  worker.onerror = () => {
    lateRejected += 1;
    finishAll('unavailable', 'SQLite worker failed');
  };

  const send = (
    op: StorageOp,
    options: {
      readonly deadlineMs?: number;
      readonly signal?: AbortSignal;
    } = {},
  ): Promise<StorageResponse> => {
    if (closed) return Promise.resolve(localResponse('closed', 'canceled'));
    const request = requestFor(op, options.deadlineMs ?? 5_000);
    if (options.signal?.aborted)
      return Promise.resolve(localResponse(request.requestId, 'canceled'));
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const entry = pending.get(request.requestId);
        if (!entry) return;
        pending.delete(request.requestId);
        entry.abort?.();
        postCancel(request.requestId);
        resolve(localResponse(request.requestId, 'timeout'));
      }, request.deadlineMs);
      const abort = bindAbort(options.signal, request.requestId, resolve);
      pending.set(request.requestId, { resolve, timer, abort });
      worker.postMessage(request);
    });
  };

  const close = async (deadlineMs = 1_000): Promise<void> => {
    if (closed) return;
    await send({ kind: 'close' }, { deadlineMs }).catch(() => undefined);
    closed = true;
    finishAll('canceled', 'SQLite worker closed');
    worker.terminate();
  };

  const diagnostics = () => ({
    lateSettled,
    lateRejected,
    pending: pending.size,
  });

  const requestFor = (op: StorageOp, deadlineMs: number): StorageRequest => ({
    requestId: `${prefix}-${(nextId += 1)}`,
    deadlineMs,
    op,
  });

  const postCancel = (targetRequestId: string): void => {
    worker.postMessage(requestFor({ kind: 'cancel', targetRequestId }, 1_000));
  };

  const bindAbort = (
    signal: AbortSignal | undefined,
    requestId: string,
    resolve: (response: StorageResponse) => void,
  ): (() => void) | undefined => {
    if (!signal) return undefined;
    const abort = () => {
      pending.delete(requestId);
      postCancel(requestId);
      resolve(localResponse(requestId, 'canceled'));
    };
    signal.addEventListener('abort', abort, { once: true });
    return () => signal.removeEventListener('abort', abort);
  };

  const finishAll = (
    outcome: StorageResponse['outcome'],
    message: string,
  ): void => {
    for (const [requestId, entry] of pending) {
      clearTimeout(entry.timer);
      entry.abort?.();
      entry.resolve(localResponse(requestId, outcome, message));
    }
    pending.clear();
  };

  return { send, close, diagnostics };
}

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
}

function localResponse(
  requestId: string,
  outcome: StorageResponse['outcome'],
  message?: string,
): StorageResponse {
  return {
    requestId,
    outcome,
    rows: [],
    rowsAffected: 0,
    diagnostics: { message },
  };
}
