import { afterEach, describe, expect, it, vi } from 'vitest';

describe('cache action budget', () => {
  afterEach(() => vi.resetModules());

  it('uses the settings override when the settings store is readable', async () => {
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => ({ settings: settingStore({ value: 128 }) }),
    }));
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      boundedStorageRead: async <T>(read: () => Promise<T>, fallback: T) => {
        try {
          return await read();
        } catch {
          return fallback;
        }
      },
    }));
    const { cacheActionBudgetBytes } =
      await import('../../../src/lib/tabs/stats/cache-action-budget');
    await expect(cacheActionBudgetBytes(64)).resolves.toBe(128);
  });

  it('falls back when the settings object store is missing', async () => {
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => ({ settings: settingStore(undefined, notFoundError()) }),
    }));
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      boundedStorageRead: async <T>(read: () => Promise<T>, fallback: T) => {
        try {
          return await read();
        } catch {
          return fallback;
        }
      },
    }));
    const { cacheActionBudgetBytes } =
      await import('../../../src/lib/tabs/stats/cache-action-budget');
    await expect(cacheActionBudgetBytes(64)).resolves.toBe(64);
  });
});

function settingStore(row: unknown, error?: Error) {
  return {
    get: async () => {
      if (error) throw error;
      return row;
    },
  };
}

function notFoundError(): Error {
  const error = new Error(
    "Failed to execute 'objectStore' on 'IDBTransaction'",
  );
  error.name = 'NotFoundError';
  return error;
}
