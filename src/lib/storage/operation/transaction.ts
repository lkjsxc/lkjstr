import type { Table } from 'dexie';
import { browserDb, type LkjstrDb } from '../browser-db';
import type { StorageTableName } from '../schema/table-spec';
import { readWithStorageResult } from '../safe-storage';
import type { StorageReadResult } from './storage-result';

export type StorageTransactionPurpose =
  | 'event-write'
  | 'feed-cursor-write'
  | 'feed-coverage-write'
  | 'feed-scan-hint-write'
  | 'notification-write'
  | 'job-write'
  | 'relay-diagnostic-write'
  | 'relay-information-write'
  | 'relay-suggestion-write'
  | 'author-route-write'
  | 'tab-snapshot-write'
  | 'protected-write';

const storageTransactionTimeoutMs = 5_000;

export async function withStorageTransaction<T>(input: {
  readonly mode: 'r' | 'rw';
  readonly tables: readonly StorageTableName[];
  readonly purpose: StorageTransactionPurpose;
  readonly run: (db: LkjstrDb) => Promise<T>;
}): Promise<StorageReadResult<T>> {
  return readWithStorageResult(
    () => {
      const db = browserDb();
      return db.transaction(
        input.mode,
        input.tables.map((table) => db[table] as Table),
        () => input.run(db),
      );
    },
    undefined as T,
    storageTransactionTimeoutMs,
    { kind: 'transaction', tables: input.tables },
  );
}
