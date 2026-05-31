import { readSettingOverrideRow } from '../../storage/repositories/settings-store';

type CacheBudgetSetting = {
  readonly value: unknown;
};

export async function cacheActionBudgetBytes(
  fallback?: number,
): Promise<number | undefined> {
  const row = (await readSettingOverrideRow(
    'cache.maxBytes',
  )) as CacheBudgetSetting | undefined;
  return typeof row?.value === 'number' ? row.value : fallback;
}
