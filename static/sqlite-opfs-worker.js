import sqlite3InitModule from './sqlite/index.mjs';

let sqlitePromise;
let opened;
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
  if (op.kind === 'apply-schema') return applySchema(request, current, op);
  if (op.kind === 'execute') return execute(request, current, op);
  if (op.kind === 'query') return query(request, current, op);
  if (op.kind === 'batch') return batch(request, current, op);
  return response(request, 'corrupt', [], 0, current.diagnostics);
}

async function open(request, database) {
  if (opened) opened.db.close();
  sqlitePromise ??= sqlite3InitModule();
  opened = await openDatabase(await sqlitePromise, database);
  return response(request, 'ok', [], 0, opened.diagnostics);
}

async function openDatabase(sqlite3, database) {
  const filename = normalizeFilename(database.databaseName);
  if (database.preferredVfs !== 'opfs-sahpool' && sqlite3.oo1.OpfsDb) {
    return {
      db: new sqlite3.oo1.OpfsDb(filename, 'c'),
      diagnostics: diagnostics(database.databaseName, 'opfs'),
    };
  }
  if (database.allowSahpool && sqlite3.installOpfsSAHPoolVfs) {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'lkjstr' });
    return {
      db: new pool.OpfsSAHPoolDb(filename, 'c'),
      diagnostics: diagnostics(database.databaseName, 'opfs-sahpool'),
    };
  }
  if (database.allowTransient) {
    return {
      db: new sqlite3.oo1.DB({ filename: ':memory:', flags: 'c' }),
      diagnostics: diagnostics(database.databaseName, 'memory'),
    };
  }
  throw new Error('OPFS SQLite storage is unavailable');
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
  return response(request, 'ok', [], 0, current.diagnostics);
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

function response(
  request,
  outcome,
  rows = [],
  rowsAffected = 0,
  diagnostics = {},
) {
  return {
    requestId: request.requestId,
    outcome,
    rows,
    rowsAffected,
    diagnostics,
  };
}

function parseRequest(value) {
  if (!record(value) || typeof value.requestId !== 'string') return undefined;
  if (typeof value.deadlineMs !== 'number') return undefined;
  if (!record(value.op) || typeof value.op.kind !== 'string') return undefined;
  return value;
}

function record(value) {
  return typeof value === 'object' && value !== null;
}

function isRow(value) {
  return record(value) && !Array.isArray(value);
}

function normalizeFilename(name) {
  return name.startsWith('/') ? name : `/${name}`;
}

function diagnostics(databaseName, vfs) {
  return { databaseName, vfs };
}

function outcomeFromError(error) {
  const text = errorText(error);
  if (/cancel/i.test(text)) return 'canceled';
  if (/busy|locked/i.test(text)) return 'busy';
  if (/quota|full|space/i.test(text)) return 'quota';
  if (/blocked/i.test(text)) return 'blocked';
  if (/corrupt|malformed|schema/i.test(text)) return 'corrupt';
  return 'unavailable';
}

function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
