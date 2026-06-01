import { describe, expect, test } from 'vitest';
import { createSqliteOpfsClient } from '../../../src/lib/storage/sqlite-opfs/client';
import type {
  StorageRequest,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

describe('SQLite OPFS client', () => {
  test('resolves responses and tracks late worker messages', async () => {
    const worker = fakeWorker();
    const client = createSqliteOpfsClient({ workerFactory: () => worker });
    const pending = client.send(
      { kind: 'estimate-storage' },
      { deadlineMs: 50 },
    );
    const request = worker.requests[0]!;
    worker.respond(response(request.requestId, 'ok'));
    await expect(pending).resolves.toMatchObject({ outcome: 'ok' });

    worker.respond(response(request.requestId, 'ok'));
    expect(client.diagnostics().lateSettled).toBe(1);
    await client.close();
    expect(worker.terminated).toBe(true);
  });

  test('times out and posts cancellation', async () => {
    const worker = fakeWorker();
    const client = createSqliteOpfsClient({ workerFactory: () => worker });
    const result = await client.send(
      { kind: 'estimate-storage' },
      { deadlineMs: 1 },
    );
    expect(result.outcome).toBe('timeout');
    expect(worker.requests.some((item) => item.op.kind === 'cancel')).toBe(
      true,
    );
    await client.close();
  });
});

function fakeWorker() {
  const requests: StorageRequest[] = [];
  let terminated = false;
  let onmessage: ((event: MessageEvent<StorageResponse>) => void) | null = null;
  return {
    requests,
    get terminated() {
      return terminated;
    },
    get onmessage() {
      return onmessage;
    },
    set onmessage(value) {
      onmessage = value;
    },
    onerror: null,
    postMessage: (message: StorageRequest) => {
      requests.push(message);
    },
    terminate() {
      terminated = true;
    },
    respond(message: StorageResponse) {
      onmessage?.({ data: message } as MessageEvent<StorageResponse>);
    },
  } as unknown as Worker & {
    readonly requests: StorageRequest[];
    terminated: boolean;
    respond: (message: StorageResponse) => void;
  };
}

function response(
  requestId: string,
  outcome: StorageResponse['outcome'],
): StorageResponse {
  return { requestId, outcome, rows: [], rowsAffected: 0, diagnostics: {} };
}
