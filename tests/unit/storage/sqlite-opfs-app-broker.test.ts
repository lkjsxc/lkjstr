import { readdir, readFile } from 'node:fs/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSqliteOpfsClient } from '../../../src/lib/storage/sqlite-opfs/client';
import {
  installSqliteOpfsAppBroker,
  sqliteOpfsBrokerGlobalName,
  sqliteProductDatabaseName,
  sqliteProductWorkerUrl,
} from '../../../src/lib/storage/sqlite-opfs/app-broker';
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

describe('SQLite OPFS app broker', () => {
  afterEach(async () => {
    await closeSqliteStorage();
    setSqliteStorageClientFactoryForTests();
    setSqliteStorageOwnerLeaseFactoryForTests();
    vi.unstubAllGlobals();
    delete (globalThis as Record<string, unknown>)[sqliteOpfsBrokerGlobalName];
  });

  test('publishes the product owner key for Rust host lookup', () => {
    const broker = installSqliteOpfsAppBroker();

    expect(broker).toMatchObject({
      kind: 'lkjstr-sqlite-opfs-broker',
      workerUrl: sqliteProductWorkerUrl,
      databaseName: sqliteProductDatabaseName,
    });
    expect(globalThis.__lkjstrSqliteOpfsBroker).toBe(broker);
  });

  test('routes persistent product hosts through the app broker', async () => {
    const registry = await readFile(
      'crates/lkjstr-web/src/sqlite_host_store/registry.rs',
      'utf8',
    );
    const owned = 'StorageWorkerClient::new_' + 'owned_module';
    const page = await readFile('src/routes/+page.svelte', 'utf8');
    const host = await readFile(
      'crates/lkjstr-web/src/host_providers.rs',
      'utf8',
    );
    const productKey = await readFile(
      'crates/lkjstr-web/src/product_storage_key.rs',
      'utf8',
    );
    const wasmModules = await readFile(
      'crates/lkjstr-web/src/wasm_modules.rs',
      'utf8',
    );
    const kernel = await readFile(
      'src/lib/storage/sqlite-opfs/kernel-client.ts',
      'utf8',
    );

    expect(registry).toContain('StorageWorkerClient::new_app_broker');
    expect(registry).not.toContain(owned);
    expect(page).toContain("import '$lib/storage/sqlite-opfs/app-broker';");
    expect(page).not.toContain('await closeSqliteStorage();');
    expect(productKey).toContain(
      'pub const PRODUCT_DATABASE_NAME: &str = "/lkjstr/main.sqlite3";',
    );
    expect(productKey).toContain('pub const PRODUCT_WORKER_URL: &str');
    expect(wasmModules).toContain('mod product_storage_key;');
    expect(host).toContain('PRODUCT_DATABASE_NAME.to_owned()');
    expect(host).not.toContain('const DEFAULT_DB_NAME');
    expect(host).not.toContain('"/lkjstr/main.sqlite3"');
    expect(kernel).toContain("const databaseName = '/lkjstr/main.sqlite3';");
  });

  test('Rust feed islands import the centralized product storage key', async () => {
    const dir = 'crates/lkjstr-web/src';
    const islandFiles = (await readdir(dir)).filter((file) =>
      file.endsWith('_island.rs'),
    );

    expect(islandFiles.length).toBeGreaterThan(0);
    for (const file of islandFiles) {
      const source = await readFile(`${dir}/${file}`, 'utf8');
      expect(source, file).toContain('PRODUCT_DATABASE_NAME');
      expect(source, file).toContain('PRODUCT_WORKER_URL');
      expect(source, file).not.toContain('DEFAULT_WORKER_URL');
      expect(source, file).not.toContain('const DEFAULT_DB_NAME');
      expect(source, file).not.toContain('= "lkjstr";');
      expect(source, file).not.toContain('"/lkjstr/main.sqlite3"');
    }
  });

  test('shares one opened owner between TypeScript and Rust-style callers', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    const worker = fakeWorker();
    let leaseAttempts = 0;
    setSqliteStorageOwnerLeaseFactoryForTests(async () => {
      leaseAttempts += 1;
      return activeLeaseFactory()();
    });
    setSqliteStorageClientFactoryForTests((lease) =>
      createSqliteOpfsClient({
        workerFactory: () => worker,
        ownerLease: lease,
      }),
    );
    const broker = installSqliteOpfsAppBroker();

    const fromTypescript = sendSqliteStorage({ kind: 'estimate-storage' });
    const fromRustHost = broker.send({ kind: 'get-storage-health' });
    await settle();

    expect(leaseAttempts).toBe(1);
    expect(worker.requests.map((item) => item.op.kind)).toEqual(['open']);
    worker.respond(ok(worker.requests[0]!.requestId));
    await settle();

    expect(worker.requests.map((item) => item.op.kind)).toEqual([
      'open',
      'estimate-storage',
      'get-storage-health',
    ]);
    worker.respond(ok(worker.requests[1]!.requestId));
    worker.respond(ok(worker.requests[2]!.requestId));
    await expect(fromTypescript).resolves.toMatchObject({ outcome: 'ok' });
    await expect(fromRustHost).resolves.toMatchObject({ outcome: 'ok' });
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

function ok(requestId: string): StorageResponse {
  return {
    requestId,
    outcome: 'ok',
    rows: [],
    rowsAffected: 0,
    diagnostics: {},
  };
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

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
