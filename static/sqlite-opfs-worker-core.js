const sahpoolCapacityBytes = 64 * 1024 * 1024;

export async function openDatabase(sqlite3, database) {
  const warnings = [];
  for (const vfs of vfsOrder(database)) {
    try {
      return await openWithVfs(sqlite3, database, vfs, warnings);
    } catch (error) {
      warnings.push(`${vfs}: ${errorText(error)}`);
    }
  }
  throw new Error(`OPFS SQLite storage is unavailable: ${warnings.join('; ')}`);
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
  if (
    /busy|locked|NoModificationAllowedError|Access Handles?|Writable stream|modifications are not allowed/i.test(
      text,
    )
  )
    return 'busy';
  if (/quota|full|space/i.test(text)) return 'quota';
  if (/blocked|denied|permission/i.test(text)) return 'blocked';
  if (/corrupt|malformed|schema/i.test(text)) return 'corrupt';
  return 'unavailable';
}

export function normalizeFilename(name) {
  return name.startsWith('/') ? name : `/${name}`;
}

export function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function vfsOrder(database) {
  if (database.forceMemory) return ['memory'];
  const base = ['opfs-sahpool', 'opfs', 'memory'];
  const preferred = database.preferredVfs;
  const ordered = preferred
    ? [preferred, ...base.filter((item) => item !== preferred)]
    : base;
  return ordered.filter((vfs) => allowed(vfs, database));
}

function allowed(vfs, database) {
  if (vfs === 'opfs-sahpool') return database.allowSahpool !== false;
  if (vfs === 'opfs') return database.allowOpfs === true;
  if (vfs === 'memory') return database.allowTransient === true;
  return false;
}

async function openWithVfs(sqlite3, database, vfs, warnings) {
  if (vfs === 'opfs-sahpool') return openSahpool(sqlite3, database, warnings);
  if (vfs === 'opfs') return openOpfs(sqlite3, database, warnings);
  return openMemory(sqlite3, database, warnings);
}

async function openSahpool(sqlite3, database, warnings) {
  if (!sqlite3.installOpfsSAHPoolVfs) throw new Error('SAH pool VFS missing');
  const pool = await sqlite3.installOpfsSAHPoolVfs({
    name: 'lkjstr',
    initialCapacity: sahpoolCapacityBytes,
  });
  const db = new pool.OpfsSAHPoolDb(
    normalizeFilename(database.databaseName),
    'c',
  );
  return opened(db, database, 'opfs-sahpool', warnings);
}

function openOpfs(sqlite3, database, warnings) {
  if (!sqlite3.oo1.OpfsDb) throw new Error('OPFS VFS missing');
  const db = new sqlite3.oo1.OpfsDb(
    normalizeFilename(database.databaseName),
    'c',
  );
  return opened(db, database, 'opfs', warnings);
}

function openMemory(sqlite3, database, warnings) {
  const db = new sqlite3.oo1.DB({ filename: ':memory:', flags: 'c' });
  return opened(db, database, 'memory', warnings);
}

function opened(db, database, vfs, warnings) {
  const mode = vfs === 'memory' ? 'temporary-memory' : 'persistent-opfs';
  const databaseName = vfs === 'memory' ? ':memory:' : database.databaseName;
  return {
    db,
    logicalDatabaseName: normalizeFilename(database.databaseName),
    diagnostics: {
      databaseName,
      vfs,
      vfsName: vfs,
      mode,
      workerKind: database.workerKind ?? 'dedicated',
      warnings,
    },
  };
}

function record(value) {
  return typeof value === 'object' && value !== null;
}
