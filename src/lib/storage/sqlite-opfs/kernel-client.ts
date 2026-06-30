import { createSqliteOpfsClient, type SqliteOpfsClient } from './client';
import {
  activeOwnerCooldown,
  clearOwnerCooldown,
  startOwnerCooldown,
} from './kernel-cooldown';
import {
  acquireSqliteOpfsOwnerLease,
  type SqliteOpfsOwnerLease,
  type SqliteOpfsOwnerLeaseResult,
} from './owner-lease';
import {
  localResponse,
  sqliteOpenUnavailable,
  sqliteStorageUnavailable,
} from './kernel-client-response';
import type { StorageOp, StorageResponse } from './types';

export type SqliteStorageClientFactory = (
  lease: SqliteOpfsOwnerLease,
) => SqliteOpfsClient;
export type SqliteStorageOwnerLeaseFactory =
  () => Promise<SqliteOpfsOwnerLeaseResult>;
export type SqliteStorageSendOptions = {
  readonly deadlineMs?: number;
  readonly signal?: AbortSignal;
};

const databaseName = '/lkjstr/main.sqlite3';
let clientFactory: SqliteStorageClientFactory =
  defaultSqliteStorageClientFactory;
let ownerLeaseFactory: SqliteStorageOwnerLeaseFactory =
  acquireSqliteOpfsOwnerLease;
let client: SqliteOpfsClient | undefined;
let openPromise: Promise<StorageResponse> | undefined;
const schemaPromises = new Map<string, Promise<StorageResponse>>();

export async function sendSqliteStorage(
  op: StorageOp,
  options: SqliteStorageSendOptions = {},
): Promise<StorageResponse> {
  const opened = await openSqliteStorage();
  if (opened.outcome !== 'ok') return opened;
  const storage = client;
  if (!storage) return sqliteStorageUnavailable();
  if (storage.closed()) return reopenAndSend(op, options);
  return storage.send(op, options);
}

export async function applySqliteSchema(
  schemaHash: string,
  statements: readonly string[],
): Promise<StorageResponse> {
  const existing = schemaPromises.get(schemaHash);
  if (existing) return existing;
  const next = sendSqliteStorage(
    { kind: 'apply-schema', schemaHash, statements },
    { deadlineMs: 10_000 },
  ).then(
    (response) => {
      if (response.outcome !== 'ok') schemaPromises.delete(schemaHash);
      return response;
    },
    (error) => {
      schemaPromises.delete(schemaHash);
      throw error;
    },
  );
  schemaPromises.set(schemaHash, next);
  return next;
}

export function setSqliteStorageClientFactoryForTests(
  factory?: SqliteStorageClientFactory,
): void {
  clientFactory = factory ?? defaultSqliteStorageClientFactory;
  resetSqliteStorageClientState();
}

export function setSqliteStorageOwnerLeaseFactoryForTests(
  factory?: SqliteStorageOwnerLeaseFactory,
): void {
  ownerLeaseFactory = factory ?? acquireSqliteOpfsOwnerLease;
  resetSqliteStorageClientState();
}

export async function closeSqliteStorage(deadlineMs = 1_000): Promise<void> {
  const storage = client;
  if (!storage) {
    resetSqliteStorageClientState();
    return;
  }
  await storage.close(deadlineMs).catch(() => undefined);
  resetSqliteStorageClientState();
}

function defaultSqliteStorageClientFactory(
  lease: SqliteOpfsOwnerLease,
): SqliteOpfsClient {
  return createSqliteOpfsClient({
    requestPrefix: 'sqlite-storage',
    ownerLease: lease,
  });
}

function openSqliteStorage(): Promise<StorageResponse> {
  const active = activeOwnerCooldown();
  if (active) return Promise.resolve(active);
  if (typeof Worker === 'undefined')
    return Promise.resolve(
      sqliteStorageUnavailable('browser-unsupported', 'Worker unsupported'),
    );
  openPromise ??= createAndOpenSqliteStorage().then(
    (response) => {
      if (response.outcome !== 'ok') {
        openPromise = undefined;
        if (ownerBlocked(response)) {
          schemaPromises.clear();
          return startOwnerCooldown(response);
        }
      }
      return response;
    },
    (error) => {
      openPromise = undefined;
      throw error;
    },
  );
  return openPromise;
}

async function createAndOpenSqliteStorage(): Promise<StorageResponse> {
  const lease = await ownerLeaseFactory();
  if (!lease.ok)
    return localResponse(
      'sqlite-storage-owner-denied',
      lease.denied.outcome,
      lease.denied.diagnostics,
    );
  let storage: SqliteOpfsClient;
  try {
    storage = clientFactory(lease.lease);
  } catch {
    lease.lease.release();
    return sqliteStorageUnavailable(
      'worker-construction-failed',
      'Worker construction failed',
    );
  }
  client = storage;
  const opened = await storage.send(
    {
      kind: 'open',
      database: {
        databaseName,
        preferredVfs: 'opfs-sahpool',
        allowSahpool: true,
        allowOpfs: true,
        allowTransient: true,
        workerKind: 'dedicated',
        ownerReason: 'web-lock-granted',
      },
    },
    { deadlineMs: 10_000 },
  );
  if (opened.outcome !== 'ok') {
    storage.terminate('SQLite persistent worker open failed');
    client = undefined;
    return sqliteOpenUnavailable(opened);
  }
  return opened;
}

async function reopenAndSend(
  op: StorageOp,
  options: SqliteStorageSendOptions,
): Promise<StorageResponse> {
  resetSqliteStorageClientState();
  const opened = await openSqliteStorage();
  if (opened.outcome !== 'ok') return opened;
  return client?.send(op, options) ?? sqliteStorageUnavailable();
}

function ownerBlocked(response: StorageResponse): boolean {
  return (
    response.outcome === 'busy' ||
    response.diagnostics.ownerReason === 'sahpool-lock-conflict' ||
    response.diagnostics.ownerReason === 'web-lock-held' ||
    response.diagnostics.ownerReason === 'web-lock-unavailable'
  );
}

function resetSqliteStorageClientState(): void {
  client?.terminate('SQLite storage client reset');
  client = undefined;
  openPromise = undefined;
  clearOwnerCooldown();
  schemaPromises.clear();
}
