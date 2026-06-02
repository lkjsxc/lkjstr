import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../../../src/lib/accounts/account';

describe('account store', () => {
  afterEach(() => vi.resetModules());

  it('disconnects accounts and removes matching local secrets', async () => {
    const account = createAccount('a'.repeat(64), 'local');
    const { saveLocalSecret, getLocalSecret } =
      await import('../../../src/lib/accounts/local-secret-store');
    const { listAccounts, removeAccount, saveAccount } =
      await import('../../../src/lib/accounts/account-store');

    await saveAccount(account);
    await saveLocalSecret({
      accountId: account.id,
      pubkey: account.pubkey,
      secretKey: '1'.repeat(64),
      createdAt: 1,
      updatedAt: 1,
    });
    await removeAccount(account.id);

    await expect(listAccounts()).resolves.toEqual([]);
    await expect(getLocalSecret(account.id)).resolves.toBeUndefined();
  });

  it('lists saved accounts from repository memory when Workers are absent', async () => {
    const account = createAccount('a'.repeat(64), 'readonly');
    const { listAccounts, saveAccount } =
      await import('../../../src/lib/accounts/account-store');

    await saveAccount(account);
    await expect(listAccounts()).resolves.toEqual([
      expect.objectContaining({ id: account.id }),
    ]);
  });

  it('falls back to a valid active account', async () => {
    const account = createAccount('a'.repeat(64), 'readonly');
    const selected: (string | null)[] = [];
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      safeGetItem: () => 'missing-account',
      safeRemoveItem: () => undefined,
      safeSetItem: (_key: string, value: string) => selected.push(value),
    }));
    const { activeAccount, saveAccount } =
      await import('../../../src/lib/accounts/account-store');

    await saveAccount(account);
    await expect(activeAccount()).resolves.toEqual(
      expect.objectContaining({ id: account.id }),
    );
    expect(selected).toEqual([account.id]);
  });
});
