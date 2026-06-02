import { readSettingOverrideRow } from '../../storage/repositories/settings-store';

type CacheBudgetSetting = {
  readonly value: unknown;
};

export async function cacheActionBudgetBytes(
  fallback?: number,
): Promise<number | undefined> {
  const row = (await Promise.race([
    readSettingOverrideRow('cache.maxBytes'),
    fallbackAfter(100, undefined),
  ])) as CacheBudgetSetting | undefined;
  return typeof row?.value === 'number' ? row.value : fallback;
}

function fallbackAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
