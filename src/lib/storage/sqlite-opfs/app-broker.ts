import {
  closeSqliteStorage,
  sendSqliteStorage,
  type SqliteStorageSendOptions,
} from './kernel-client';
import {
  sqliteOpfsBrokerGlobalName,
  sqliteProductDatabaseName,
  sqliteProductWorkerUrl,
} from './product-key';
import type { StorageOp, StorageResponse } from './types';

export {
  sqliteOpfsBrokerGlobalName,
  sqliteProductDatabaseName,
  sqliteProductWorkerUrl,
} from './product-key';

export type SqliteOpfsAppBroker = {
  readonly kind: 'lkjstr-sqlite-opfs-broker';
  readonly version: 1;
  readonly origin: string;
  readonly workerUrl: string;
  readonly databaseName: string;
  send(
    op: StorageOp,
    options?: SqliteStorageSendOptions,
  ): Promise<StorageResponse>;
  close(deadlineMs?: number): Promise<void>;
};

declare global {
  // eslint-disable-next-line no-var
  var __lkjstrSqliteOpfsBroker: SqliteOpfsAppBroker | undefined;
}

export function installSqliteOpfsAppBroker(): SqliteOpfsAppBroker {
  const existing = globalThis.__lkjstrSqliteOpfsBroker;
  if (isProductBroker(existing)) return existing;
  const broker = createSqliteOpfsAppBroker();
  Object.defineProperty(globalThis, sqliteOpfsBrokerGlobalName, {
    configurable: true,
    value: broker,
  });
  return broker;
}

export function sqliteOpfsAppBroker(): SqliteOpfsAppBroker {
  return installSqliteOpfsAppBroker();
}

function createSqliteOpfsAppBroker(): SqliteOpfsAppBroker {
  return {
    kind: 'lkjstr-sqlite-opfs-broker',
    version: 1,
    origin: currentOrigin(),
    workerUrl: sqliteProductWorkerUrl,
    databaseName: sqliteProductDatabaseName,
    send: (op, options) => sendSqliteStorage(op, options),
    close: (deadlineMs) => closeSqliteStorage(deadlineMs),
  };
}

function isProductBroker(
  broker: SqliteOpfsAppBroker | undefined,
): broker is SqliteOpfsAppBroker {
  return (
    broker?.kind === 'lkjstr-sqlite-opfs-broker' &&
    broker.version === 1 &&
    broker.workerUrl === sqliteProductWorkerUrl &&
    broker.databaseName === sqliteProductDatabaseName &&
    typeof broker.send === 'function' &&
    typeof broker.close === 'function'
  );
}

function currentOrigin(): string {
  return globalThis.location?.origin ?? 'unknown-origin';
}

installSqliteOpfsAppBroker();
