import { afterEach, describe, expect, it } from 'vitest';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);

describe('account storage fallback', () => {
  afterEach(() => {
    if (localStorageDescriptor)
      Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('keeps active account selection in memory when localStorage is denied', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied');
      },
    });
    const { getActiveAccountId, setActiveAccountId } =
      await import('../../../src/lib/accounts/account-store');
    setActiveAccountId('account-a');
    expect(getActiveAccountId()).toBe('account-a');
    setActiveAccountId(null);
    expect(getActiveAccountId()).toBeNull();
  });
});
