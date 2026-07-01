import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../../../src/lib/accounts/account';
import type { ProtectedStorageState } from '../../../src/lib/storage/protected-storage-state';

describe('workspace page data', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('preserves page account data when relay settings are unavailable', async () => {
    const account = createAccount('a'.repeat(64), 'readonly');
    vi.doMock('../../../src/lib/accounts/account-store', () => ({
      listAccounts: vi.fn(async () => [account]),
      activeAccount: vi.fn(async () => account),
    }));
    vi.doMock('../../../src/lib/accounts/account-manager', () => ({
      addReadonlyAccount: vi.fn(),
      addReadonlyPubkey: vi.fn(),
      addNip07Account: vi.fn(),
      importLocalNsec: vi.fn(),
      addMinedLocalAccount: vi.fn(),
    }));
    vi.doMock('../../../src/lib/relays/relay-store', () => ({
      listRelaySets: vi.fn(async () => {
        throw protectedStorageError('opfs-owner-held');
      }),
    }));

    const { loadWorkspacePageData } =
      await import('../../../src/lib/workspace/workspace-page-data');
    const data = await loadWorkspacePageData();

    expect(data.activeAccount?.pubkey).toBe(account.pubkey);
    expect(data.relaySets).toEqual([]);
    expect(data.storageState).toMatchObject({ reason: 'opfs-owner-held' });
    expect(data.relayReadPlan.source).toBe('session-default-public-read');
    expect(data.relayReadPlan.relays.length).toBeGreaterThan(0);
    expect(data.relayReadPlan.writeAllowed).toBe(false);
  });

  it('keeps the previous real page account during account storage failure', async () => {
    const previous = createAccount('b'.repeat(64), 'readonly');
    const { pageActiveAccount } =
      await import('../../../src/lib/workspace/workspace-page-data');
    const data = {
      accounts: [],
      relaySets: [],
      relayReadPlan: {
        source: 'session-default-public-read' as const,
        relays: ['wss://relay.example/'],
        writeAllowed: false,
      },
      accountStorageState: storageState('web-lock-held'),
      storageState: storageState('web-lock-held'),
    };

    expect(pageActiveAccount(previous, data)?.pubkey).toBe(previous.pubkey);
  });
});

function protectedStorageError(reason: string) {
  const state = storageState(reason);
  return Object.assign(new Error(state.message), {
    name: 'ProtectedStorageError' as const,
    state,
    response: { outcome: 'busy', diagnostics: { ownerReason: reason } },
  });
}

function storageState(reason: string): ProtectedStorageState {
  return {
    kind: 'busy',
    reason,
    message: `Protected storage is unavailable: ${reason}.`,
  };
}
