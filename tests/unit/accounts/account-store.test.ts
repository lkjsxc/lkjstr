import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../../../src/lib/accounts/account';

describe('account store', () => {
  afterEach(() => vi.resetModules());

  it('disconnects accounts and removes matching local secrets', async () => {
    const account = createAccount('a'.repeat(64), 'local');
    const tables = fakeTables(account);
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => tables,
    }));
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      bestEffortStorageWrite: async (write: () => Promise<unknown>) => write(),
      boundedStorageRead: async (read: () => Promise<unknown>) => read(),
      safeGetItem: () => account.id,
      safeRemoveItem: () => undefined,
      safeSetItem: () => undefined,
    }));
    const { removeAccount } =
      await import('../../../src/lib/accounts/account-store');
    await removeAccount(account.id);
    expect(tables.accounts.records).toHaveLength(0);
    expect(tables.localAccountSecrets.records).toHaveLength(0);
  });

  it('filters unsupported stored signer types', async () => {
    const account = createAccount('a'.repeat(64), 'readonly');
    const unsupported = { ...account, id: 'old:a', signerType: 'old-type' };
    const tables = fakeTables(account, unsupported);
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => tables,
    }));
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      bestEffortStorageWrite: async (write: () => Promise<unknown>) => write(),
      boundedStorageRead: async (read: () => Promise<unknown>) => read(),
      safeGetItem: () => null,
      safeRemoveItem: () => undefined,
      safeSetItem: () => undefined,
    }));
    const { listAccounts } =
      await import('../../../src/lib/accounts/account-store');
    await expect(listAccounts()).resolves.toEqual([account]);
  });

  it('falls back to a valid active account', async () => {
    const account = createAccount('a'.repeat(64), 'readonly');
    const tables = fakeTables(account);
    const selected: (string | null)[] = [];
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => tables,
    }));
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      bestEffortStorageWrite: async (write: () => Promise<unknown>) => write(),
      boundedStorageRead: async (read: () => Promise<unknown>) => read(),
      safeGetItem: () => 'old:a',
      safeRemoveItem: () => undefined,
      safeSetItem: (_key: string, value: string) => selected.push(value),
    }));
    const { activeAccount } =
      await import('../../../src/lib/accounts/account-store');
    await expect(activeAccount()).resolves.toEqual(account);
    expect(selected).toEqual([account.id]);
  });
});

function fakeTables(...accounts: Record<string, unknown>[]) {
  return {
    accounts: table(accounts, 'id'),
    localAccountSecrets: table(
      accounts.map((account) => ({ accountId: account.id })),
      'accountId',
    ),
  };
}

function table(initial: readonly Record<string, unknown>[], key: string) {
  const records = [...initial];
  return {
    records,
    put: async (record: Record<string, unknown>) => {
      records.push(record);
      return undefined;
    },
    delete: async (id: string) => {
      const index = records.findIndex((record) => record[key] === id);
      if (index >= 0) records.splice(index, 1);
    },
    get: async (id: string) => records.find((record) => record[key] === id),
    orderBy: () => ({ reverse: () => ({ toArray: async () => records }) }),
    toArray: async () => records,
  };
}
