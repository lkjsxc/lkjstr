import type { Workspace } from '../../workspace/workspace';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';

const workspaceSchemaHash = 'workspace-sqlite-cutover';
const workspaceSchema = [
  `CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  layout_json TEXT NOT NULL,
  active_pane_id TEXT,
  active_tab_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS workspaces_updated_at_idx ON workspaces(updated_at_ms DESC);',
];

export async function sqliteReadWorkspace(
  id: string,
): Promise<Workspace | undefined> {
  if (!(await ensureWorkspaceSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT layout_json FROM workspaces WHERE workspace_id = ?1 LIMIT 1;',
      params: [id],
      rowLimit: 1,
    },
    { deadlineMs: 10_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  const raw = response.rows[0]?.layout_json;
  return typeof raw === 'string' ? decodeWorkspace(raw) : undefined;
}

export async function sqlitePutWorkspace(
  workspace: Workspace,
): Promise<boolean> {
  if (!(await ensureWorkspaceSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement:
        'INSERT INTO workspaces (workspace_id, layout_json, active_pane_id, active_tab_id, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(workspace_id) DO UPDATE SET layout_json = excluded.layout_json, active_pane_id = excluded.active_pane_id, active_tab_id = excluded.active_tab_id, updated_at_ms = excluded.updated_at_ms;',
      params: [
        workspace.id,
        JSON.stringify(workspace),
        workspace.focusedPaneId,
        workspace.focusedTabId,
        workspace.updatedAt,
        workspace.updatedAt,
      ],
    },
    { deadlineMs: 10_000 },
  );
  return response.outcome === 'ok';
}

async function ensureWorkspaceSchema(): Promise<boolean> {
  const response = await applySqliteSchema(
    workspaceSchemaHash,
    workspaceSchema,
  );
  return response.outcome === 'ok';
}

function decodeWorkspace(raw: string): Workspace | undefined {
  try {
    return JSON.parse(raw) as Workspace;
  } catch {
    return undefined;
  }
}
