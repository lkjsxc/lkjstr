import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createSqliteWorkerCore } from './worker-core';
import type { SqliteModule } from './database';
import type { StorageDiagnostics } from './types';

const core = createSqliteWorkerCore({
  initSqlite,
  estimateStorage,
  post: (response) => self.postMessage(response),
});

self.onmessage = (event: MessageEvent<unknown>) => {
  void core.handle(event.data);
};

async function estimateStorage(): Promise<StorageDiagnostics> {
  const estimate = await self.navigator.storage?.estimate?.();
  return {
    storageUsageBytes: estimate?.usage,
    storageQuotaBytes: estimate?.quota,
  };
}

async function initSqlite(): Promise<SqliteModule> {
  return (await sqlite3InitModule()) as unknown as SqliteModule;
}
