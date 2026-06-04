import { cacheLedgerId } from '../../cache/cache-ledger-id';
import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { TabStateRecord } from '../tab-state-record';
import { applySqliteSchema } from './kernel-client';
import {
  cacheLedgerSqlStep,
  sqliteRecordBatch,
  sqliteRecordReadMany,
  sqliteRecordReadOne,
} from './sqlite-record-helpers';
import type { SqlStep } from './types';

const tabStateSchemaHash = 'tab-states-sqlite-cutover';
const tabStateSchema = [
  `CREATE TABLE IF NOT EXISTS tab_states (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  last_pane_id TEXT,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS tab_states_workspace_idx ON tab_states(workspace_id, updated_at_ms DESC);',
  `CREATE TABLE IF NOT EXISTS cache_ledger (
  id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  protected INTEGER NOT NULL CHECK (protected IN (0, 1)),
  record_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
];

export async function sqlitePutTabState(
  row: TabStateRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<boolean> {
  return sqliteRecordBatch(ensureTabStateSchema, [
    tabStateStep(row),
    cacheLedgerSqlStep(ledgerRow),
  ]);
}

export function sqliteReadTabState(
  id: string,
): Promise<TabStateRecord | undefined> {
  return sqliteRecordReadOne<TabStateRecord>(
    ensureTabStateSchema,
    'tab_states',
    'id = ?1',
    [id],
  );
}

export function sqliteReadWorkspaceTabStates(
  workspaceId: string,
): Promise<TabStateRecord[] | undefined> {
  return sqliteRecordReadMany<TabStateRecord>(
    ensureTabStateSchema,
    'tab_states',
    'workspace_id = ?1 OR id LIKE ?2',
    [workspaceId, `${workspaceId}:%`],
    5000,
  );
}

export function sqliteDeleteTabStates(
  ids: readonly string[],
): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return Promise.resolve(true);
  return sqliteRecordBatch(
    ensureTabStateSchema,
    chunks(unique, 250).flatMap(deleteSteps),
  );
}

export async function ensureTabStateSchema(): Promise<boolean> {
  const response = await applySqliteSchema(tabStateSchemaHash, tabStateSchema);
  return response.outcome === 'ok';
}

function tabStateStep(row: TabStateRecord): SqlStep {
  return {
    statement:
      'INSERT INTO tab_states (id, workspace_id, tab_id, last_pane_id, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET workspace_id = excluded.workspace_id, tab_id = excluded.tab_id, last_pane_id = excluded.last_pane_id, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.workspaceId,
      row.tabId,
      row.lastPaneId ?? null,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

function deleteSteps(ids: readonly string[]): SqlStep[] {
  return [
    {
      statement: `DELETE FROM tab_states WHERE id IN (${placeholders(ids)});`,
      params: ids,
    },
    {
      statement: `DELETE FROM cache_ledger WHERE owner_kind = ?1 AND resource_id IN (${placeholders(ids, 2)});`,
      params: ['tab-snapshot', ...ids],
    },
    {
      statement: `DELETE FROM cache_ledger WHERE id IN (${placeholders(ids)});`,
      params: ids.map((id) => cacheLedgerId('tab-snapshot', id)),
    },
  ];
}

function placeholders(values: readonly unknown[], start = 1): string {
  return values.map((_, index) => `?${index + start}`).join(', ');
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    out.push(values.slice(index, index + size));
  return out;
}
