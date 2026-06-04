import type { Page } from '@playwright/test';

export type SqlStep = {
  readonly statement: string;
  readonly params?: readonly unknown[];
};

export type SqlRow = Record<string, unknown>;

type BrowserSqliteTestApi = {
  readonly applySchema: (
    schemaHash: string,
    statements: readonly string[],
  ) => Promise<{ readonly outcome: string }>;
  readonly send: (op: unknown) => Promise<{
    readonly outcome: string;
    readonly rows?: readonly SqlRow[];
  }>;
};

const sqliteTables = [
  'accounts',
  'author_relay_routes',
  'cache_ledger',
  'cache_meta',
  'event_relays',
  'event_tags',
  'events',
  'feed_coverage',
  'feed_cursors',
  'feed_scan_decision_traces',
  'feed_scan_density_models',
  'feed_scan_hints',
  'feed_scan_observations',
  'jobs',
  'local_account_secrets',
  'notifications',
  'relay_diagnostic_summaries',
  'relay_information',
  'relay_list_suggestions',
  'relay_route_blocks',
  'relay_sets',
  'settings',
  'tab_states',
  'tweet_drafts',
  'workspaces',
] as const;

export async function clearSqliteStorage(page: Page): Promise<void> {
  await waitForSqliteTestApi(page);
  const result = await page.evaluate(sqliteResetEval, sqliteTables);
  if (result.outcome !== 'ok') throw new Error(JSON.stringify(result));
}

export async function runSqliteBatch(
  page: Page,
  schemaHash: string,
  statements: readonly string[],
  steps: readonly SqlStep[],
): Promise<void> {
  await waitForSqliteTestApi(page);
  const result = await page.evaluate(sqliteBatchEval, {
    schemaHash,
    statements,
    steps,
  });
  if (result.open !== 'ok' || result.schema !== 'ok' || result.batch !== 'ok')
    throw new Error(JSON.stringify(result));
}

export async function querySqliteRows<T extends SqlRow>(
  page: Page,
  schemaHash: string,
  statements: readonly string[],
  statement: string,
  params: readonly unknown[],
  rowLimit: number,
): Promise<T[]> {
  await waitForSqliteTestApi(page);
  const result = await page.evaluate(sqliteQueryEval, {
    schemaHash,
    statements,
    statement,
    params,
    rowLimit,
  });
  if (result.open !== 'ok' || result.schema !== 'ok' || result.query !== 'ok')
    throw new Error(JSON.stringify(result));
  return result.rows as T[];
}

async function sqliteResetEval(tables: readonly string[]) {
  const api = (
    window as Window & {
      __lkjstrSqliteStorageTest?: BrowserSqliteTestApi;
    }
  ).__lkjstrSqliteStorageTest;
  if (!api) return { outcome: 'unavailable' };
  const response = await api.send({
    kind: 'batch',
    mode: 'readwrite',
    steps: [
      { statement: 'PRAGMA foreign_keys = OFF;' },
      ...tables.map((table) => ({
        statement: `DROP TABLE IF EXISTS ${table};`,
      })),
      { statement: 'PRAGMA foreign_keys = ON;' },
    ],
  });
  return { outcome: response.outcome };
}

async function waitForSqliteTestApi(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        (
          window as Window & {
            __lkjstrSqliteStorageTest?: BrowserSqliteTestApi;
          }
        ).__lkjstrSqliteStorageTest,
      ),
    undefined,
    { timeout: 10_000 },
  );
}

async function sqliteBatchEval(input: {
  readonly schemaHash: string;
  readonly statements: readonly string[];
  readonly steps: readonly SqlStep[];
}) {
  const api = (
    window as Window & {
      __lkjstrSqliteStorageTest?: BrowserSqliteTestApi;
    }
  ).__lkjstrSqliteStorageTest;
  if (!api)
    return { open: 'unavailable', schema: 'unavailable', batch: 'unavailable' };
  const schema = await api.applySchema(input.schemaHash, input.statements);
  const batch = await api.send({
    kind: 'batch',
    mode: 'readwrite',
    steps: input.steps,
  });
  return { open: 'ok', schema: schema.outcome, batch: batch.outcome };
}

async function sqliteQueryEval(input: {
  readonly schemaHash: string;
  readonly statements: readonly string[];
  readonly statement: string;
  readonly params: readonly unknown[];
  readonly rowLimit: number;
}) {
  const api = (
    window as Window & {
      __lkjstrSqliteStorageTest?: BrowserSqliteTestApi;
    }
  ).__lkjstrSqliteStorageTest;
  if (!api)
    return {
      open: 'unavailable',
      schema: 'unavailable',
      query: 'unavailable',
      rows: [],
    };
  const schema = await api.applySchema(input.schemaHash, input.statements);
  const query = await api.send({
    kind: 'query',
    statement: input.statement,
    params: input.params,
    rowLimit: input.rowLimit,
  });
  return {
    open: 'ok',
    schema: schema.outcome,
    query: query.outcome,
    rows: query.rows ?? [],
  };
}
