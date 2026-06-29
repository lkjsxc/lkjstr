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
  StorageDiagnostics,
  StorageRequest,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

describe('SQLite OPFS owner lease', () => {
  afterEach(async () => {
    await closeSqliteStorage();
    setSqliteStorageClientFactoryForTests();
    setSqliteStorageOwnerLeaseFactoryForTests();
    vi.unstubAllGlobals();
  });

  test('does not construct a worker when owner lease is denied', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    let constructed = 0;
    setSqliteStorageOwnerLeaseFactoryForTests(deniedLeaseFactory());
    setSqliteStorageClientFactoryForTests(() => {
      constructed += 1;
      return createSqliteOpfsClient({ workerFactory: () => fakeWorker() });
    });

    const result = await sendSqliteStorage({ kind: 'estimate-storage' });

    expect(result).toMatchObject({
      outcome: 'busy',
      diagnostics: { ownerReason: 'web-lock-held' },
    });
    expect(constructed).toBe(0);
  });

  test('uses owner cooldown instead of retrying denied opens', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    let leaseAttempts = 0;
    setSqliteStorageOwnerLeaseFactoryForTests(async () => {
      leaseAttempts += 1;
      return deniedLeaseFactory()();
    });

    await sendSqliteStorage({ kind: 'estimate-storage' });
    const second = await sendSqliteStorage({ kind: 'estimate-storage' });

    expect(leaseAttempts).toBe(1);
    expect(second).toMatchObject({
      outcome: 'busy',
      diagnostics: { ownerReason: 'web-lock-held' },
    });
  });

  test('terminates failed worker and cools down SAH owner conflicts', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    const release = vi.fn();
    const worker = fakeWorker();
    let constructed = 0;
    setSqliteStorageOwnerLeaseFactoryForTests(activeLeaseFactory(release));
    setSqliteStorageClientFactoryForTests((lease) => {
      constructed += 1;
      return createSqliteOpfsClient({
        workerFactory: () => worker,
        ownerLease: lease,
      });
    });

    const pending = sendSqliteStorage({ kind: 'estimate-storage' });
    await Promise.resolve();
    const open = worker.requests[0]!;
    worker.respond(
      response(open.requestId, 'busy', {
        storageOwner: 'busy',
        ownerReason: 'sahpool-lock-conflict',
      }),
    );
    const first = await pending;
    const second = await sendSqliteStorage({ kind: 'estimate-storage' });

    expect(first).toMatchObject({
      outcome: 'busy',
      diagnostics: { ownerReason: 'sahpool-lock-conflict' },
    });
    expect(worker.terminated).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
    expect(constructed).toBe(1);
    expect(second.diagnostics.retryAfterMs).toBeGreaterThan(0);
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
    postMessage: (message: StorageRequest) => requests.push(message),
    terminate: () => (terminated = true),
    respond: (message: StorageResponse) =>
      onmessage?.({ data: message } as MessageEvent<StorageResponse>),
  } as unknown as Worker & {
    readonly requests: StorageRequest[];
    terminated: boolean;
    respond: (message: StorageResponse) => void;
  };
}

function response(
  requestId: string,
  outcome: StorageResponse['outcome'],
  diagnostics: StorageDiagnostics = {},
): StorageResponse {
  return { requestId, outcome, rows: [], rowsAffected: 0, diagnostics };
}

function activeLeaseFactory(release = vi.fn()) {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: true,
    lease: {
      diagnostics: { storageOwner: 'active', ownerReason: 'web-lock-granted' },
      release,
    },
  });
}

function deniedLeaseFactory() {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: false,
    denied: {
      outcome: 'busy',
      diagnostics: {
        storageOwner: 'busy',
        ownerReason: 'web-lock-held',
        retryAfterMs: 2_000,
        message: 'SQLite OPFS storage is open in another tab.',
      },
    },
  });
}
