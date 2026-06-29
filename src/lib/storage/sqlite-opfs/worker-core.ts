import {
  errorText,
  executeSql,
  querySql,
  runBatch,
  sqliteOutcomeFromError,
  type SqliteModule,
} from './database';
import { response, parseRequest } from './worker-envelope';
import { createStorageHealth } from './worker-health';
import {
  normalizeDatabaseName,
  openSqliteDatabase,
  type OpenedSqliteDatabase,
} from './open-database';
import { readPhysicalInventoryRows } from './physical-inventory';
import type {
  OpenDatabase,
  StorageDiagnostics,
  StorageOp,
  StorageRequest,
  StorageResponse,
} from './types';

export type SqliteWorkerCore = ReturnType<typeof createSqliteWorkerCore>;

export type SqliteWorkerCoreOptions = {
  readonly initSqlite: () => Promise<SqliteModule>;
  readonly estimateStorage: () => Promise<StorageDiagnostics>;
  readonly post: (response: StorageResponse) => void;
};

export function createSqliteWorkerCore(options: SqliteWorkerCoreOptions) {
  let sqlitePromise: Promise<SqliteModule> | undefined;
  let sqliteModule: SqliteModule | undefined;
  let opened: OpenedSqliteDatabase | undefined;
  const lastIntegrityCheckAt: number | null = null;
  const appliedSchemaChanges = new Set<string>();
  const canceled = new Set<string>();

  const handle = async (message: unknown): Promise<void> => {
    const request = parseRequest(message);
    if (!request) return;
    if (request.op.kind === 'cancel') {
      canceled.add(request.op.targetRequestId);
      options.post(response(request, 'ok'));
      return;
    }
    options.post(await run(request));
  };

  const run = async (request: StorageRequest): Promise<StorageResponse> => {
    if (canceled.delete(request.requestId))
      return response(request, 'canceled');
    const start = Date.now();
    try {
      const result = await runOp(request.op, request);
      if (Date.now() - start > request.deadlineMs)
        return response(request, 'timeout', undefined, 0, result.diagnostics);
      return result;
    } catch (error) {
      return response(request, sqliteOutcomeFromError(error), undefined, 0, {
        ...opened?.diagnostics,
        message: errorText(error),
      });
    }
  };

  const runOp = async (
    op: StorageOp,
    request: StorageRequest,
  ): Promise<StorageResponse> => {
    if (op.kind === 'open') return open(request, op.database);
    if (!opened && op.kind !== 'estimate-storage' && op.kind !== 'close')
      throw new Error('SQLite database is not open');
    if (op.kind === 'close') return close(request);
    if (op.kind === 'estimate-storage') return estimate(request);
    const current = opened;
    if (!current) throw new Error('SQLite database is not open');
    if (op.kind === 'get-storage-health') return health(request, current);
    if (op.kind === 'read-physical-inventory')
      return physicalInventory(request, current);
    if (op.kind === 'apply-schema') return applySchema(request, current, op);
    if (op.kind === 'execute') {
      const rowsAffected = executeSql(current.db, op.statement, op.params);
      return response(
        request,
        'ok',
        undefined,
        rowsAffected,
        current.diagnostics,
      );
    }
    if (op.kind === 'query') {
      const rows = querySql(current.db, op.statement, op.params, op.rowLimit);
      return response(request, 'ok', rows, 0, current.diagnostics);
    }
    if (op.kind === 'batch') {
      const rowsAffected = runBatch(current.db, op.steps);
      return response(
        request,
        'ok',
        undefined,
        rowsAffected,
        current.diagnostics,
      );
    }
    return response(request, 'corrupt', undefined, 0, current.diagnostics);
  };

  const open = async (request: StorageRequest, database: OpenDatabase) => {
    const requestedName = normalizeDatabaseName(database.databaseName);
    if (opened?.logicalDatabaseName === requestedName)
      return response(request, 'ok', undefined, 0, opened.diagnostics);
    if (opened)
      return response(request, 'busy', undefined, 0, {
        ...opened.diagnostics,
        message: 'SQLite storage owner is already open',
      });
    sqlitePromise ??= options.initSqlite();
    sqliteModule = await sqlitePromise;
    opened = await openSqliteDatabase(sqliteModule, database);
    return response(request, 'ok', undefined, 0, opened.diagnostics);
  };

  const applySchema = (
    request: StorageRequest,
    current: OpenedSqliteDatabase,
    op: Extract<StorageOp, { kind: 'apply-schema' }>,
  ): StorageResponse => {
    if (!appliedSchemaChanges.has(op.schemaHash)) {
      for (const statement of op.statements) current.db.exec(statement);
      appliedSchemaChanges.add(op.schemaHash);
    }
    return response(request, 'ok', undefined, 0, current.diagnostics);
  };

  const health = (
    request: StorageRequest,
    current: OpenedSqliteDatabase,
  ): StorageResponse => {
    const health = createStorageHealth({
      current,
      sqliteModule,
      appliedSchemaChanges,
      lastIntegrityCheckAt,
    });
    return response(request, 'ok', undefined, 0, {
      ...current.diagnostics,
      health,
    });
  };

  const physicalInventory = (
    request: StorageRequest,
    current: OpenedSqliteDatabase,
  ): StorageResponse =>
    response(
      request,
      'ok',
      readPhysicalInventoryRows(current),
      0,
      current.diagnostics,
    );

  const close = (request: StorageRequest): StorageResponse => {
    opened?.db.close();
    opened = undefined;
    appliedSchemaChanges.clear();
    canceled.clear();
    return response(request, 'ok');
  };

  const estimate = async (request: StorageRequest): Promise<StorageResponse> =>
    response(request, 'ok', undefined, 0, await options.estimateStorage());

  return { handle };
}
