import { afterEach, describe, expect, it, vi } from 'vitest';

describe('cache action budget', () => {
  afterEach(() => vi.resetModules());

  it('uses the settings override when the settings store is readable', async () => {
    const { replaceSettingOverrideRows } =
      await import('../../../src/lib/storage/repositories/settings-store');
    await replaceSettingOverrideRows([
      {
        key: 'cache.maxBytes',
        namespace: 'cache',
        value: 128,
        updatedAt: 1,
      },
    ]);

    const { cacheActionBudgetBytes } =
      await import('../../../src/lib/tabs/stats/cache-action-budget');
    await expect(cacheActionBudgetBytes(64)).resolves.toBe(128);
  });

  it('falls back when the settings store is unavailable', async () => {
    const { cacheActionBudgetBytes } =
      await import('../../../src/lib/tabs/stats/cache-action-budget');
    await expect(cacheActionBudgetBytes(64)).resolves.toBe(64);
  });
});
