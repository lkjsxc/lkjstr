import { describe, expect, test } from 'vitest';

type WorkerOp = { readonly kind: string; readonly targetRequestId?: string };
type WorkerRequest = {
  readonly requestId: string;
  readonly deadlineMs: number;
  readonly op: WorkerOp;
};
type WorkerResponse = {
  readonly requestId: string;
  readonly outcome: string;
  readonly rows: readonly unknown[];
  readonly rowsAffected: number;
  readonly diagnostics: Record<string, unknown>;
};
type QueueModule = {
  readonly createCommandQueue: (options: {
    readonly parseRequest: (value: unknown) => WorkerRequest | undefined;
    readonly run: (request: WorkerRequest) => Promise<WorkerResponse>;
    readonly post: (message: WorkerResponse) => void;
    readonly response: (
      request: WorkerRequest,
      outcome: string,
    ) => WorkerResponse;
    readonly canceled: Set<string>;
  }) => (message: unknown) => Promise<void> | undefined;
};

describe('static SQLite worker command queue', () => {
  test('serializes non-cancel commands and posts one response per request', async () => {
    const { createCommandQueue } = await queueModule();
    const posts: WorkerResponse[] = [];
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const enqueue = createCommandQueue({
      parseRequest,
      run: (request) =>
        new Promise((resolve) => {
          started.push(request.requestId);
          resolvers.push(() => resolve(response(request, 'ok')));
        }),
      post: (message) => posts.push(message),
      response,
      canceled: new Set(),
    });

    const first = enqueue(request('first', { kind: 'estimate-storage' }));
    const second = enqueue(request('second', { kind: 'estimate-storage' }));

    await Promise.resolve();
    expect(started).toEqual(['first']);
    resolvers.shift()?.();
    await first;
    await Promise.resolve();
    expect(started).toEqual(['first', 'second']);
    resolvers.shift()?.();
    await second;
    expect(posts.map((item) => item.requestId)).toEqual(['first', 'second']);
  });

  test('records cancellation immediately without waiting for the queue', async () => {
    const { createCommandQueue } = await queueModule();
    const posts: WorkerResponse[] = [];
    const canceled = new Set<string>();
    let release: (() => void) | undefined;
    const enqueue = createCommandQueue({
      parseRequest,
      run: (request) =>
        new Promise((resolve) => {
          release = () => resolve(response(request, 'ok'));
        }),
      post: (message) => posts.push(message),
      response,
      canceled,
    });

    const pending = enqueue(request('slow', { kind: 'estimate-storage' }));
    await enqueue(
      request('cancel-1', { kind: 'cancel', targetRequestId: 'slow' }),
    );

    expect(canceled.has('slow')).toBe(true);
    expect(posts.map((item) => item.requestId)).toEqual(['cancel-1']);
    release?.();
    await pending;
    expect(posts.map((item) => item.requestId)).toEqual(['cancel-1', 'slow']);
  });
});

async function queueModule(): Promise<QueueModule> {
  return (await import(
    new URL('../../../static/sqlite-opfs-worker-queue.js', import.meta.url).href
  )) as QueueModule;
}

function parseRequest(value: unknown): WorkerRequest | undefined {
  return typeof value === 'object' && value
    ? (value as WorkerRequest)
    : undefined;
}

function request(requestId: string, op: WorkerOp): WorkerRequest {
  return { requestId, deadlineMs: 5_000, op };
}

function response(request: WorkerRequest, outcome: string): WorkerResponse {
  return {
    requestId: request.requestId,
    outcome,
    rows: [],
    rowsAffected: 0,
    diagnostics: {},
  };
}
