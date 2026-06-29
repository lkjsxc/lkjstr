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

describe('SQLite OPFS owner recovery', () => {
  afterEach(async () => {
    await closeSqliteStorage();
    setSqliteStorageClientFactoryForTests();
    setSqliteStorageOwnerLeaseFactoryForTests();
    vi.unstubAllGlobals();
    allWorkers.splice(0);
  });

  test('worker error releases the lease and settles pending work unavailable', async () => {
    const release = vi.fn();
    const worker = fakeWorker();
    const client = createSqliteOpfsClient({
      workerFactory: () => worker,
      ownerLease: activeLease(release),
    });

    const pending = client.send(
      { kind: 'estimate-storage' },
      { deadlineMs: 50 },
    );
    worker.fail();

    await expect(pending).resolves.toMatchObject({ outcome: 'unavailable' });
    expect(client.closed()).toBe(true);
    expect(worker.terminated).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('worker construction failure releases the acquired owner lease', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    const release = vi.fn();
    setSqliteStorageOwnerLeaseFactoryForTests(async () => ({
      ok: true,
      lease: activeLease(release),
    }));
    setSqliteStorageClientFactoryForTests(() => {
      throw new Error('boom');
    });

    await expect(
      sendSqliteStorage({ kind: 'estimate-storage' }),
    ).resolves.toMatchObject({
      outcome: 'unavailable',
    });
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('closed singleton client is replaced on the next command', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    const workers = [fakeWorker(), fakeWorker()];
    setSqliteStorageOwnerLeaseFactoryForTests(activeLeaseFactory());
    setSqliteStorageClientFactoryForTests((lease) =>
      createSqliteOpfsClient({
        workerFactory: () => workers.shift()!,
        ownerLease: lease,
      }),
    );

    const first = sendSqliteStorage({ kind: 'estimate-storage' });
    await settle();
    const firstWorker = workersSnapshot()[0];
    firstWorker.respond(ok(firstWorker.requests[0]!.requestId));
    await settle();
    firstWorker.respond(ok(firstWorker.requests[1]!.requestId));
    await expect(first).resolves.toMatchObject({ outcome: 'ok' });
    firstWorker.fail();

    const second = sendSqliteStorage({ kind: 'estimate-storage' });
    await settle();
    const secondWorker = workersSnapshot()[1];
    secondWorker.respond(ok(secondWorker.requests[0]!.requestId));
    await settle();
    secondWorker.respond(ok(secondWorker.requests[1]!.requestId));
    await expect(second).resolves.toMatchObject({ outcome: 'ok' });

    function workersSnapshot() {
      return allWorkers;
    }
  });
});

type FakeWorker = Worker & {
  readonly requests: StorageRequest[];
  readonly terminated: boolean;
  respond: (message: StorageResponse) => void;
  fail: () => void;
};

const allWorkers: FakeWorker[] = [];

function fakeWorker(): FakeWorker {
  const requests: StorageRequest[] = [];
  let terminated = false;
  let onmessage: ((event: MessageEvent<StorageResponse>) => void) | null = null;
  let onerror: (() => void) | null = null;
  const worker = {
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
    get onerror() {
      return onerror;
    },
    set onerror(value) {
      onerror = value;
    },
    postMessage: (message: StorageRequest) => requests.push(message),
    terminate: () => (terminated = true),
    respond: (message: StorageResponse) =>
      onmessage?.({ data: message } as MessageEvent<StorageResponse>),
    fail: () => onerror?.(),
  } as unknown as FakeWorker;
  allWorkers.push(worker);
  return worker;
}

function ok(requestId: string): StorageResponse {
  return {
    requestId,
    outcome: 'ok',
    rows: [],
    rowsAffected: 0,
    diagnostics: {},
  };
}

function activeLease(release = vi.fn()) {
  return {
    diagnostics: {
      storageOwner: 'active' as const,
      ownerReason: 'web-lock-granted' as const,
    },
    release,
  };
}

function activeLeaseFactory() {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: true,
    lease: activeLease(),
  });
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
