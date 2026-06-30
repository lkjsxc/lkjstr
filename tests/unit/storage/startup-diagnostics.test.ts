import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  appLogRecords,
  clearAppLogForTests,
} from '../../../src/lib/log/app-log';
import {
  readStartupStorageDiagnostics,
  refreshStartupStorageDiagnostics,
} from '../../../src/lib/storage/sqlite-opfs/startup-diagnostics';
import {
  sqliteOpfsBrokerGlobalName,
  sqliteProductDatabaseName,
  sqliteProductWorkerUrl,
} from '../../../src/lib/storage/sqlite-opfs/product-key';
import type {
  StorageOp,
  StorageResponse,
} from '../../../src/lib/storage/sqlite-opfs/types';

describe('startup storage diagnostics', () => {
  afterEach(() => {
    clearAppLogForTests();
    delete (globalThis as Record<string, unknown>)[sqliteOpfsBrokerGlobalName];
  });

  test('reports missing broker without opening storage', async () => {
    const snapshot = await readStartupStorageDiagnostics(undefined);

    expect(snapshot.rows).toEqual([
      expect.objectContaining({
        key: 'broker',
        status: 'unavailable',
        reason: 'broker-missing',
      }),
    ]);
  });

  test('reports product key mismatch before worker calls', async () => {
    const broker = {
      workerUrl: sqliteProductWorkerUrl,
      databaseName: 'lkjstr',
      send: vi.fn(),
    };
    const snapshot = await readStartupStorageDiagnostics(broker);

    expect(snapshot.rows[0]).toMatchObject({
      key: 'broker',
      reason: 'broker-key-mismatch',
    });
    expect(broker.send).not.toHaveBeenCalled();
  });

  test('probes health and protected/cache rows through the broker', async () => {
    const broker = fakeBroker({
      accounts: 1,
      settings: 1,
      relay_sets: 2,
      events: 3,
    });
    const snapshot = await readStartupStorageDiagnostics(broker);

    expect(
      snapshot.rows.map((row) => [row.key, row.status, row.count]),
    ).toEqual([
      ['broker', 'ok', undefined],
      ['storage-health', 'ok', undefined],
      ['accounts', 'ok', 1],
      ['active-selector', 'ok', 1],
      ['relay-settings', 'ok', 2],
      ['profile-headers', 'ok', 3],
    ]);
  });

  test('logs startup failures once per probe reason', async () => {
    await refreshStartupStorageDiagnostics();
    await refreshStartupStorageDiagnostics();

    expect(appLogRecords()).toHaveLength(1);
    expect(appLogRecords()[0]).toMatchObject({
      area: 'storage',
      code: 'startup-broker',
      message: 'App broker: broker-missing',
    });
  });
});

function fakeBroker(counts: Record<string, number>) {
  return {
    workerUrl: sqliteProductWorkerUrl,
    databaseName: sqliteProductDatabaseName,
    send: vi.fn(async (op: StorageOp): Promise<StorageResponse> => {
      if (op.kind === 'get-storage-health')
        return response('ok', undefined, 'persistent-opfs');
      if (op.kind !== 'query') return response('unavailable');
      if (op.statement.includes('sqlite_schema'))
        return response('ok', [{ count: 1 }]);
      const table = Object.keys(counts).find((name) =>
        op.statement.includes(name),
      );
      return response('ok', [{ count: counts[table ?? ''] ?? 0 }]);
    }),
  };
}

function response(
  outcome: StorageResponse['outcome'],
  rows: StorageResponse['rows'] = [],
  mode?: 'persistent-opfs',
): StorageResponse {
  return {
    requestId: 'startup-test',
    outcome,
    rows,
    rowsAffected: 0,
    diagnostics: { mode },
  };
}
