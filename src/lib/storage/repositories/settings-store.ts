import type { SettingOverride } from '../../settings/settings-store';
import {
  sqliteDeleteSettingOverride,
  sqliteDeleteSettingOverrides,
  sqlitePutSettingOverride,
  sqliteReadSettingOverride,
  sqliteReadSettingOverrides,
  sqliteReplaceSettingOverrides,
} from '../sqlite-opfs/settings-sqlite';

let memoryRows: SettingOverride[] = [];

export async function readSettingOverrideRows(
  fallback: SettingOverride[],
): Promise<SettingOverride[]> {
  const rows = await sqliteReadSettingOverrides().catch(() => undefined);
  memoryRows = rows ?? fallback;
  return memoryRows;
}

export async function readSettingOverrideRow(
  key: string,
): Promise<SettingOverride | undefined> {
  return (
    (await sqliteReadSettingOverride(key).catch(() => undefined)) ??
    memoryRows.find((row) => row.key === key)
  );
}

export async function putSettingOverrideRow(
  override: SettingOverride,
): Promise<void> {
  memoryRows = [
    ...memoryRows.filter((row) => row.key !== override.key),
    override,
  ];
  await sqlitePutSettingOverride(override).catch(() => false);
}

export async function deleteSettingOverrideRow(key: string): Promise<void> {
  memoryRows = memoryRows.filter((row) => row.key !== key);
  await sqliteDeleteSettingOverride(key).catch(() => false);
}

export async function deleteSettingOverrideRows(
  keys: readonly string[],
): Promise<void> {
  const remove = new Set(keys);
  memoryRows = memoryRows.filter((row) => !remove.has(row.key));
  await sqliteDeleteSettingOverrides(keys).catch(() => false);
}

export async function replaceSettingOverrideRows(
  overrides: readonly SettingOverride[],
): Promise<void> {
  memoryRows = [...overrides];
  await sqliteReplaceSettingOverrides(overrides).catch(() => false);
}
