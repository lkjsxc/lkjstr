import type { SettingOverride } from '../../settings/settings-store';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import type { SqlRow } from './types';

const settingsSchemaHash = 'settings-sqlite-cutover';
const settingsSchema = [
  `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS settings_namespace_idx ON settings(namespace);',
];

export async function sqliteReadSettingOverrides(): Promise<
  SettingOverride[] | undefined
> {
  if (!(await ensureSettingsSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT key, namespace, value_json, updated_at FROM settings ORDER BY key ASC;',
      rowLimit: 10_000,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.map(decodeSettingOverride);
}

export async function sqliteReadSettingOverride(
  key: string,
): Promise<SettingOverride | undefined> {
  if (!(await ensureSettingsSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT key, namespace, value_json, updated_at FROM settings WHERE key = ?1;',
      params: [key],
      rowLimit: 1,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows[0] ? decodeSettingOverride(response.rows[0]) : undefined;
}

export async function sqlitePutSettingOverride(
  override: SettingOverride,
): Promise<boolean> {
  if (!(await ensureSettingsSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement:
        'INSERT INTO settings (key, namespace, value_json, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(key) DO UPDATE SET namespace = excluded.namespace, value_json = excluded.value_json, updated_at = excluded.updated_at;',
      params: encodeSettingOverride(override),
    },
    { deadlineMs: 3_000 },
  );
  return response.outcome === 'ok';
}

export async function sqliteDeleteSettingOverride(
  key: string,
): Promise<boolean> {
  if (!(await ensureSettingsSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement: 'DELETE FROM settings WHERE key = ?1;',
      params: [key],
    },
    { deadlineMs: 3_000 },
  );
  return response.outcome === 'ok';
}

export async function sqliteDeleteSettingOverrides(
  keys: readonly string[],
): Promise<boolean> {
  if (keys.length === 0) return true;
  if (!(await ensureSettingsSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'batch',
      mode: 'readwrite',
      steps: keys.map((key) => ({
        statement: 'DELETE FROM settings WHERE key = ?1;',
        params: [key],
      })),
    },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok';
}

export async function sqliteReplaceSettingOverrides(
  overrides: readonly SettingOverride[],
): Promise<boolean> {
  if (!(await ensureSettingsSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'batch',
      mode: 'readwrite',
      steps: [
        { statement: 'DELETE FROM settings;' },
        ...overrides.map((override) => ({
          statement:
            'INSERT INTO settings (key, namespace, value_json, updated_at) VALUES (?1, ?2, ?3, ?4);',
          params: encodeSettingOverride(override),
        })),
      ],
    },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok';
}

async function ensureSettingsSchema(): Promise<boolean> {
  const response = await applySqliteSchema(settingsSchemaHash, settingsSchema);
  return response.outcome === 'ok';
}

function encodeSettingOverride(override: SettingOverride) {
  return [
    override.key,
    override.namespace,
    JSON.stringify(override.value),
    override.updatedAt,
  ] as const;
}

function decodeSettingOverride(row: SqlRow): SettingOverride {
  return {
    key: stringField(row, 'key'),
    namespace: stringField(row, 'namespace'),
    value: JSON.parse(stringField(row, 'value_json')),
    updatedAt: numberField(row, 'updated_at'),
  };
}

function stringField(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`invalid setting ${key}`);
  return value;
}

function numberField(row: SqlRow, key: string): number {
  const value = row[key];
  if (typeof value !== 'number') throw new Error(`invalid setting ${key}`);
  return value;
}
