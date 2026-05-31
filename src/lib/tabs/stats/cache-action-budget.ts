import { browserDb } from '../../storage/browser-db';
import { boundedStorageRead } from '../../storage/safe-storage';

type CacheBudgetSetting = {
  readonly value: unknown;
};

export async function cacheActionBudgetBytes(
  fallback?: number,
): Promise<number | undefined> {
  const row = await boundedStorageRead<CacheBudgetSetting | undefined>(
    () => browserDb().settings.get('cache.maxBytes'),
    undefined,
  );
  return typeof row?.value === 'number' ? row.value : fallback;
}
