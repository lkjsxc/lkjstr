import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../../../src/lib/accounts/account';

describe('account store', () => {
  afterEach(() => vi.resetModules());

  it('disconnects accounts without deleting encrypted passkey records', async () => {
    const account = createAccount('a'.repeat(64), 'passkey-local');
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
    expect(tables.passkeyAccountSecrets.records).toHaveLength(1);
  });
});

function fakeTables(account: ReturnType<typeof createAccount>) {
  return {
    accounts: table([account], 'id'),
    localAccountSecrets: table([{ accountId: account.id }], 'accountId'),
    passkeyAccountSecrets: table([{ accountId: account.id }], 'accountId'),
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
