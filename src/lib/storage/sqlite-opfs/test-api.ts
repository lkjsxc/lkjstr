import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import type { StorageOp, StorageResponse } from './types';

type SqliteStorageTestApi = {
  readonly applySchema: (
    schemaHash: string,
    statements: readonly string[],
  ) => Promise<StorageResponse>;
  readonly send: (op: StorageOp) => Promise<StorageResponse>;
};

declare global {
  interface Window {
    __lkjstrSqliteStorageTest?: SqliteStorageTestApi;
  }
}

export function installSqliteStorageTestApi(): void {
  if (typeof window === 'undefined' || !testApiAllowed()) return;
  window.__lkjstrSqliteStorageTest = {
    applySchema: (schemaHash, statements) =>
      applySqliteSchema(schemaHash, statements),
    send: (op) => sendSqliteStorage(op),
  };
}

function testApiAllowed(): boolean {
  return ['127.0.0.1', 'localhost'].includes(window.location.hostname);
}
