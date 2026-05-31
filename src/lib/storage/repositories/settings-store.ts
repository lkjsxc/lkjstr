import type { SettingOverride } from '../../settings/settings-store';
import { browserDb } from '../browser-db';
import { bestEffortStorageWrite, boundedStorageRead } from '../safe-storage';

export async function readSettingOverrideRows(
  fallback: SettingOverride[],
): Promise<SettingOverride[]> {
  return boundedStorageRead(() => browserDb().settings.toArray(), fallback);
}

export async function readSettingOverrideRow(
  key: string,
): Promise<SettingOverride | undefined> {
  return boundedStorageRead(() => browserDb().settings.get(key), undefined);
}

export async function putSettingOverrideRow(
  override: SettingOverride,
): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().settings.put(override));
}

export async function deleteSettingOverrideRow(key: string): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().settings.delete(key));
}

export async function deleteSettingOverrideRows(
  keys: readonly string[],
): Promise<void> {
  await bestEffortStorageWrite(() =>
    browserDb().settings.bulkDelete([...keys]),
  );
}

export async function replaceSettingOverrideRows(
  overrides: readonly SettingOverride[],
): Promise<void> {
  await bestEffortStorageWrite(async () => {
    await browserDb().settings.clear();
    await browserDb().settings.bulkPut([...overrides]);
  });
}
