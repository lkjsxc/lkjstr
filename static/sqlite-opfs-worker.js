import sqlite3InitModule from './sqlite/index.mjs';
import {
  errorText,
  isRow,
  openDatabase,
  outcomeFromError,
  parseRequest,
  response,
} from './sqlite-opfs-worker-core.js';
import { createStorageHealth } from './sqlite-opfs-worker-health.js';

let sqlitePromise, sqliteModule;
let opened;
const appliedSchemaChanges = new Set();
const lastIntegrityCheckAt = null;
const canceled = new Set();

self.onmessage = (event) => {
  void handle(event.data);
};

async function handle(message) {
  const request = parseRequest(message);
  if (!request) return;
  if (request.op.kind === 'cancel') {
    canceled.add(request.op.targetRequestId);
    self.postMessage(response(request, 'ok'));
    return;
  }
  self.postMessage(await run(request));
}

async function run(request) {
  if (canceled.delete(request.requestId)) return response(request, 'canceled');
  const start = Date.now();
  try {
    const result = await runOp(request);
    if (Date.now() - start > request.deadlineMs) {
      return response(request, 'timeout', [], 0, result.diagnostics);
    }
    return result;
  } catch (error) {
    return response(request, outcomeFromError(error), [], 0, {
      ...opened?.diagnostics,
      message: errorText(error),
    });
  }
}

async function runOp(request) {
  const op = request.op;
  if (op.kind === 'open') return open(request, op.database);
  if (!opened && op.kind !== 'estimate-storage' && op.kind !== 'close') {
    throw new Error('SQLite database is not open');
  }
  if (op.kind === 'close') return close(request);
  if (op.kind === 'estimate-storage') return estimate(request);
  const current = opened;
  if (!current) throw new Error('SQLite database is not open');
  if (op.kind === 'get-storage-health') return health(request, current);
  if (op.kind === 'apply-schema') return applySchema(request, current, op);
  if (op.kind === 'execute') return execute(request, current, op);
  if (op.kind === 'query') return query(request, current, op);
  if (op.kind === 'batch') return batch(request, current, op);
  return response(request, 'corrupt', [], 0, current.diagnostics);
}

async function open(request, database) {
  if (opened) opened.db.close();
  sqlitePromise ??= sqlite3InitModule();
  sqliteModule = await sqlitePromise;
  opened = await openDatabase(sqliteModule, database);
  return response(request, 'ok', [], 0, opened.diagnostics);
}

function close(request) {
  opened?.db.close();
  opened = undefined;
  canceled.clear();
  return response(request, 'ok');
}

async function estimate(request) {
  const value = await self.navigator.storage?.estimate?.();
  return response(request, 'ok', [], 0, {
    storageUsageBytes: value?.usage,
    storageQuotaBytes: value?.quota,
  });
}

function applySchema(request, current, op) {
  for (const statement of op.statements) current.db.exec(statement);
  appliedSchemaChanges.add(op.schemaHash);
  return response(request, 'ok', [], 0, current.diagnostics);
}

function health(request, current) {
  const health = createStorageHealth({
    current,
    sqliteModule,
    appliedSchemaChanges,
    lastIntegrityCheckAt,
  });
  return response(request, 'ok', [], 0, { ...current.diagnostics, health });
}

function execute(request, current, op) {
  current.db.exec({ sql: op.statement, bind: op.params });
  return response(
    request,
    'ok',
    [],
    current.db.changes(false, false),
    current.diagnostics,
  );
}

function query(request, current, op) {
  const rows = current.db.exec({
    sql: op.statement,
    bind: op.params,
    rowMode: 'object',
    returnValue: 'resultRows',
  });
  const limited = Array.isArray(rows)
    ? rows.filter(isRow).slice(0, op.rowLimit)
    : [];
  return response(request, 'ok', limited, 0, current.diagnostics);
}

function batch(request, current, op) {
  let rowsAffected = 0;
  current.db.exec('BEGIN IMMEDIATE');
  try {
    for (const step of op.steps) {
      current.db.exec({ sql: step.statement, bind: step.params });
      rowsAffected += current.db.changes(false, false);
    }
    current.db.exec('COMMIT');
    return response(request, 'ok', [], rowsAffected, current.diagnostics);
  } catch (error) {
    current.db.exec('ROLLBACK');
    throw error;
  }
}
