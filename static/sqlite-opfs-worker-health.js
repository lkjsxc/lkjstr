export function createStorageHealth(input) {
  const warnings = [...(input.current.diagnostics.warnings ?? [])];
  return {
    mode: input.current.diagnostics.mode ?? 'temporary-memory',
    vfsName: input.current.diagnostics.vfsName ?? 'memory',
    workerKind: input.current.diagnostics.workerKind ?? 'unknown',
    sqliteVersion: sqliteVersion(input.sqliteModule),
    databaseName: input.current.diagnostics.databaseName ?? ':memory:',
    appliedSchemaChanges: [...input.appliedSchemaChanges],
    pageCount: pragmaNumber(input.current, 'page_count', warnings),
    pageSize: pragmaNumber(input.current, 'page_size', warnings),
    freelistCount: pragmaNumber(input.current, 'freelist_count', warnings),
    eventCount: tableCount(input.current, 'events', warnings),
    relayReceiptCount: tableCount(input.current, 'event_relays', warnings),
    tagRowCount: tableCount(input.current, 'event_tags', warnings),
    lastIntegrityCheckAt: input.lastIntegrityCheckAt,
    warnings,
  };
}

function sqliteVersion(sqliteModule) {
  return (
    sqliteModule?.version?.libVersion ??
    sqliteModule?.capi?.sqlite3_libversion?.() ??
    'unknown'
  );
}

function pragmaNumber(current, name, warnings) {
  return firstNumber(current, `PRAGMA ${name};`, name, warnings);
}

function tableCount(current, table, warnings) {
  return firstNumber(
    current,
    `SELECT COUNT(*) AS row_count FROM ${table};`,
    'row_count',
    warnings,
  );
}

function firstNumber(current, sql, key, warnings) {
  try {
    const rows = current.db.exec({
      sql,
      rowMode: 'object',
      returnValue: 'resultRows',
    });
    const value = rows?.[0]?.[key];
    return typeof value === 'number' ? value : 0;
  } catch (error) {
    warnings.push(`${key}: ${errorText(error)}`);
    return 0;
  }
}

function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
