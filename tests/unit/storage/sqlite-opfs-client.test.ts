import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSqliteOpfsClient } from '../../../src/lib/storage/sqlite-opfs/client';
import {
  closeSqliteStorage,
  sendSqliteStorage,
  setSqliteStorageClientFactoryForTests,
  setSqliteStorageOwnerLeaseFactoryForTests,
} from '../../../src/lib/storage/sqlite-opfs/kernel-client';
import type { SqliteOpfsOwnerLeaseResult } from '../../../src/lib/storage/sqlite-opfs/owner-lease';
import type {
  StorageRequest,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

describe('SQLite OPFS client', () => {
  afterEach(async () => {
    await closeSqliteStorage();
    setSqliteStorageClientFactoryForTests();
    setSqliteStorageOwnerLeaseFactoryForTests();
    vi.unstubAllGlobals();
  });
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

  test('coalesces singleton storage open before concurrent commands', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    const worker = fakeWorker();
    setSqliteStorageOwnerLeaseFactoryForTests(activeLeaseFactory());
    setSqliteStorageClientFactoryForTests((lease) =>
      createSqliteOpfsClient({
        workerFactory: () => worker,
        ownerLease: lease,
      }),
    );

    const first = sendSqliteStorage({ kind: 'estimate-storage' });
    const second = sendSqliteStorage({ kind: 'estimate-storage' });
    await settleClient();

    expect(worker.requests.map((item) => item.op.kind)).toEqual(['open']);
    worker.respond(response(worker.requests[0]!.requestId, 'ok'));
    await settleClient();

    expect(worker.requests.map((item) => item.op.kind)).toEqual([
      'open',
      'estimate-storage',
      'estimate-storage',
    ]);
    worker.respond(response(worker.requests[1]!.requestId, 'ok'));
    worker.respond(response(worker.requests[2]!.requestId, 'ok'));
    await expect(first).resolves.toMatchObject({ outcome: 'ok' });
    await expect(second).resolves.toMatchObject({ outcome: 'ok' });
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

async function settleClient(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function activeLeaseFactory(release = vi.fn()) {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: true,
    lease: {
      diagnostics: {
        storageOwner: 'active',
        ownerReason: 'web-lock-granted',
      },
      release,
    },
  });
}
