export async function openDatabase(sqlite3, database) {
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

export function response(
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

export function parseRequest(value) {
  if (!record(value) || typeof value.requestId !== 'string') return undefined;
  if (typeof value.deadlineMs !== 'number') return undefined;
  if (!record(value.op) || typeof value.op.kind !== 'string') return undefined;
  return value;
}

export function isRow(value) {
  return record(value) && !Array.isArray(value);
}

export function outcomeFromError(error) {
  const text = errorText(error);
  if (/cancel/i.test(text)) return 'canceled';
  if (/busy|locked/i.test(text)) return 'busy';
  if (/quota|full|space/i.test(text)) return 'quota';
  if (/blocked/i.test(text)) return 'blocked';
  if (/corrupt|malformed|schema/i.test(text)) return 'corrupt';
  return 'unavailable';
}

function record(value) {
  return typeof value === 'object' && value !== null;
}

function normalizeFilename(name) {
  return name.startsWith('/') ? name : `/${name}`;
}

function diagnostics(databaseName, vfs) {
  const mode = vfs === 'memory' ? 'temporary-memory' : 'persistent-opfs';
  databaseName = vfs === 'memory' ? ':memory:' : databaseName;
  return {
    databaseName,
    vfs,
    vfsName: vfs,
    mode,
    workerKind: 'dedicated',
    warnings: [],
  };
}

export function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
