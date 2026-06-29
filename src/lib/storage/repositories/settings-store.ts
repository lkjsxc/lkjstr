import type { SettingOverride } from '../../settings/settings-store';
import {
  sqliteDeleteSettingOverride,
  sqliteDeleteSettingOverrides,
  sqlitePutSettingOverride,
  sqliteReadSettingOverride,
  sqliteReadSettingOverrides,
  sqliteReplaceSettingOverrides,
} from '../sqlite-opfs/settings-sqlite';
import { protectedStorageStateFromError } from '../protected-storage-state';

let memoryRows: SettingOverride[] = [];

export async function readSettingOverrideRows(
  fallback: SettingOverride[],
): Promise<SettingOverride[]> {
  const rows = await sqliteReadSettingOverrides()
    .then((rows) => {
      if (rows) memoryRows = rows;
      return rows;
    })
    .catch(undefinedUnlessProtected);
  memoryRows = rows ?? fallback;
  return memoryRows;
}

export async function readSettingOverrideRow(
  key: string,
): Promise<SettingOverride | undefined> {
  const memory = memoryRows.find((row) => row.key === key);
  if (memory) return memory;
  return sqliteReadSettingOverride(key).catch(undefinedUnlessProtected);
}

export async function putSettingOverrideRow(
  override: SettingOverride,
): Promise<void> {
  memoryRows = [
    ...memoryRows.filter((row) => row.key !== override.key),
    override,
  ];
  await sqlitePutSettingOverride(override).catch(undefinedUnlessProtected);
}

export async function deleteSettingOverrideRow(key: string): Promise<void> {
  memoryRows = memoryRows.filter((row) => row.key !== key);
  await sqliteDeleteSettingOverride(key).catch(undefinedUnlessProtected);
}

export async function deleteSettingOverrideRows(
  keys: readonly string[],
): Promise<void> {
  const remove = new Set(keys);
  memoryRows = memoryRows.filter((row) => !remove.has(row.key));
  await sqliteDeleteSettingOverrides(keys).catch(undefinedUnlessProtected);
}

export async function replaceSettingOverrideRows(
  overrides: readonly SettingOverride[],
): Promise<void> {
  memoryRows = [...overrides];
  await sqliteReplaceSettingOverrides(overrides).catch(
    undefinedUnlessProtected,
  );
}

function undefinedUnlessProtected(error: unknown): undefined {
  if (protectedStorageStateFromError(error)) throw error;
  return undefined;
}
