import type { SettingOverride } from '../../settings/settings-store';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import type { SqlRow } from './types';

const settingsSchemaHash = 'settings-sqlite-cutover';
const settingsSchema = [
  `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS settings_updated_at_idx ON settings(updated_at_ms DESC);',
];

export async function sqliteReadSettingOverrides(): Promise<
  SettingOverride[] | undefined
> {
  if (!(await ensureSettingsSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT key, value_json, updated_at_ms FROM settings ORDER BY key ASC;',
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
        'SELECT key, value_json, updated_at_ms FROM settings WHERE key = ?1;',
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
        'INSERT INTO settings (key, value_json, updated_at_ms) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at_ms = excluded.updated_at_ms;',
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
            'INSERT INTO settings (key, value_json, updated_at_ms) VALUES (?1, ?2, ?3);',
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
    JSON.stringify(override.value),
    override.updatedAt,
  ] as const;
}

function decodeSettingOverride(row: SqlRow): SettingOverride {
  return {
    key: stringField(row, 'key'),
    namespace: settingNamespace(stringField(row, 'key')),
    value: JSON.parse(stringField(row, 'value_json')),
    updatedAt: numberField(row, 'updated_at_ms'),
  };
}

function settingNamespace(key: string): string {
  return key.includes('.') ? (key.split('.')[0] ?? 'debug') : 'debug';
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
