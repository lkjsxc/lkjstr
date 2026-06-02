import { errorText, type SqliteDatabase, type SqliteModule } from './database';
import type { OpenDatabase, StorageDiagnostics, VfsName } from './types';

export type OpenedSqliteDatabase = {
  readonly db: SqliteDatabase;
  readonly diagnostics: StorageDiagnostics;
};

const sahpoolCapacityBytes = 64 * 1024 * 1024;

export async function openSqliteDatabase(
  sqlite3: SqliteModule,
  request: OpenDatabase,
): Promise<OpenedSqliteDatabase> {
  const warnings: string[] = [];
  for (const vfs of vfsOrder(request)) {
    try {
      return await openWithVfs(sqlite3, request, vfs, warnings);
    } catch (error) {
      warnings.push(`${vfs}: ${errorText(error)}`);
    }
  }
  throw new Error(`OPFS SQLite storage is unavailable: ${warnings.join('; ')}`);
}

export function sqliteVersion(sqlite3: SqliteModule): string {
  return (
    sqlite3.version?.libVersion ??
    sqlite3.capi?.sqlite3_libversion?.() ??
    'unknown'
  );
}

function vfsOrder(request: OpenDatabase): VfsName[] {
  if (request.forceMemory) return ['memory'];
  const base: VfsName[] = ['opfs-sahpool', 'opfs', 'memory'];
  const preferred = request.preferredVfs;
  const ordered = preferred
    ? [preferred, ...base.filter((item) => item !== preferred)]
    : base;
  return ordered.filter((vfs) => allowed(vfs, request));
}

function allowed(vfs: VfsName, request: OpenDatabase): boolean {
  if (vfs === 'opfs-sahpool') return request.allowSahpool !== false;
  if (vfs === 'opfs') return request.allowOpfs !== false;
  if (vfs === 'memory') return request.allowTransient === true;
  return false;
}

async function openWithVfs(
  sqlite3: SqliteModule,
  request: OpenDatabase,
  vfsName: VfsName,
  warnings: readonly string[],
): Promise<OpenedSqliteDatabase> {
  if (vfsName === 'opfs-sahpool')
    return openSahpool(sqlite3, request, warnings);
  if (vfsName === 'opfs') return openOpfs(sqlite3, request, warnings);
  return openMemory(sqlite3, request, warnings);
}

async function openSahpool(
  sqlite3: SqliteModule,
  request: OpenDatabase,
  warnings: readonly string[],
): Promise<OpenedSqliteDatabase> {
  if (!sqlite3.installOpfsSAHPoolVfs) throw new Error('SAH pool VFS missing');
  const pool = await sqlite3.installOpfsSAHPoolVfs({
    name: 'lkjstr',
    initialCapacity: sahpoolCapacityBytes,
  });
  const db = new pool.OpfsSAHPoolDb(
    normalizeFilename(request.databaseName),
    'c',
  );
  return opened(db, request, 'opfs-sahpool', warnings);
}

function openOpfs(
  sqlite3: SqliteModule,
  request: OpenDatabase,
  warnings: readonly string[],
): OpenedSqliteDatabase {
  if (!sqlite3.oo1.OpfsDb) throw new Error('OPFS VFS missing');
  const db = new sqlite3.oo1.OpfsDb(
    normalizeFilename(request.databaseName),
    'c',
  );
  return opened(db, request, 'opfs', warnings);
}

function openMemory(
  sqlite3: SqliteModule,
  request: OpenDatabase,
  warnings: readonly string[],
): OpenedSqliteDatabase {
  const db = new sqlite3.oo1.DB({ filename: ':memory:', flags: 'c' });
  return opened(db, request, 'memory', warnings);
}

function opened(
  db: SqliteDatabase,
  request: OpenDatabase,
  vfsName: VfsName,
  warnings: readonly string[],
): OpenedSqliteDatabase {
  const mode = vfsName === 'memory' ? 'temporary-memory' : 'persistent-opfs';
  const databaseName = vfsName === 'memory' ? ':memory:' : request.databaseName;
  return {
    db,
    diagnostics: {
      databaseName,
      mode,
      vfs: vfsName,
      vfsName,
      workerKind: request.workerKind ?? 'dedicated',
      warnings,
    },
  };
}

function normalizeFilename(name: string): string {
  return name.startsWith('/') ? name : `/${name}`;
}
