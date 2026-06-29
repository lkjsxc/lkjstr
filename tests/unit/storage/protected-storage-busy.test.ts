import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  closeSqliteStorage,
  setSqliteStorageClientFactoryForTests,
  setSqliteStorageOwnerLeaseFactoryForTests,
} from '../../../src/lib/storage/sqlite-opfs/kernel-client';
import type { SqliteOpfsOwnerLeaseResult } from '../../../src/lib/storage/sqlite-opfs/owner-lease';

describe('protected storage busy states', () => {
  afterEach(async () => {
    await closeSqliteStorage();
    setSqliteStorageClientFactoryForTests();
    setSqliteStorageOwnerLeaseFactoryForTests();
    vi.unstubAllGlobals();
  });

  test('protected repositories reject busy storage instead of empty fallback', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    setSqliteStorageOwnerLeaseFactoryForTests(deniedLeaseFactory());
    const accounts =
      await import('../../../src/lib/storage/repositories/accounts-store');
    const relays =
      await import('../../../src/lib/storage/repositories/relay-sets-store');
    const settings =
      await import('../../../src/lib/storage/repositories/settings-store');
    const drafts =
      await import('../../../src/lib/storage/repositories/tweet-drafts-store');

    await expect(accounts.readAccountRows([])).rejects.toMatchObject({
      name: 'ProtectedStorageError',
      state: { kind: 'busy' },
    });
    await expect(relays.readRelaySetRows([])).rejects.toMatchObject({
      name: 'ProtectedStorageError',
      state: { kind: 'busy' },
    });
    await expect(settings.readSettingOverrideRows([])).rejects.toMatchObject({
      name: 'ProtectedStorageError',
      state: { kind: 'busy' },
    });
    await expect(
      drafts.readTweetDraftRow('draft-1', undefined),
    ).rejects.toMatchObject({
      name: 'ProtectedStorageError',
      state: { kind: 'busy' },
    });
  });

  test('workspace data renders a storage busy state', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    setSqliteStorageOwnerLeaseFactoryForTests(deniedLeaseFactory());
    const { loadWorkspacePageData } =
      await import('../../../src/lib/workspace/workspace-page-data');

    await expect(loadWorkspacePageData()).resolves.toMatchObject({
      accounts: [],
      relaySets: [],
      storageState: { kind: 'busy', reason: 'web-lock-held' },
    });
  });
});

function deniedLeaseFactory() {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: false,
    denied: {
      outcome: 'busy',
      diagnostics: {
        storageOwner: 'busy',
        ownerReason: 'web-lock-held',
        retryAfterMs: 2_000,
        message: 'SQLite OPFS storage is open in another tab.',
      },
    },
  });
}
