import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  closeSqliteStorage,
  sendSqliteStorage,
  setSqliteStorageClientFactoryForTests,
  setSqliteStorageOwnerLeaseFactoryForTests,
} from '../../../src/lib/storage/sqlite-opfs/kernel-client';
import type { SqliteOpfsClient } from '../../../src/lib/storage/sqlite-opfs/client';
import type { SqliteOpfsOwnerLeaseResult } from '../../../src/lib/storage/sqlite-opfs/owner-lease';
import type { StorageResponse } from '../../../src/lib/storage/sqlite-opfs/types';

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

  test('kernel response names unsupported worker storage explicitly', async () => {
    vi.stubGlobal('Worker', undefined);

    await expect(
      sendSqliteStorage({ kind: 'estimate-storage' }),
    ).resolves.toMatchObject({
      outcome: 'unavailable',
      diagnostics: { ownerReason: 'browser-unsupported' },
    });
  });

  test('protected repositories reject sqlite open failure explicitly', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    setSqliteStorageOwnerLeaseFactoryForTests(activeLeaseFactory());
    setSqliteStorageClientFactoryForTests(() => sqliteOpenFailureClient());
    const accounts =
      await import('../../../src/lib/storage/repositories/accounts-store');

    await expect(accounts.readAccountRows([])).rejects.toMatchObject({
      name: 'ProtectedStorageError',
      state: { kind: 'unavailable', reason: 'sqlite-open-failed' },
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

  test('protected busy state preserves browser-local holder diagnostics', async () => {
    vi.stubGlobal('Worker', function Worker() {});
    setSqliteStorageOwnerLeaseFactoryForTests(deniedLeaseFactory('owner-test'));
    const { loadWorkspacePageData } =
      await import('../../../src/lib/workspace/workspace-page-data');

    await expect(loadWorkspacePageData()).resolves.toMatchObject({
      storageState: {
        kind: 'busy',
        ownerHolderId: 'owner-test',
        message: 'SQLite OPFS storage is open in another tab (owner-test).',
      },
    });
  });
});

function deniedLeaseFactory(ownerHolderId?: string) {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: false,
    denied: {
      outcome: 'busy',
      diagnostics: {
        storageOwner: 'busy',
        ownerReason: 'web-lock-held',
        ownerHolderId,
        retryAfterMs: 2_000,
        message: ownerHolderId
          ? `SQLite OPFS storage is open in another tab (${ownerHolderId}).`
          : 'SQLite OPFS storage is open in another tab.',
      },
    },
  });
}

function activeLeaseFactory(release = vi.fn()) {
  return async (): Promise<SqliteOpfsOwnerLeaseResult> => ({
    ok: true,
    lease: {
      diagnostics: { storageOwner: 'active', ownerReason: 'web-lock-granted' },
      release,
    },
  });
}

function sqliteOpenFailureClient(): SqliteOpfsClient {
  const response: StorageResponse = {
    requestId: 'open-failed',
    outcome: 'unavailable',
    rows: [],
    rowsAffected: 0,
    diagnostics: {},
  };
  return {
    send: async () => response,
    close: async () => undefined,
    terminate: vi.fn(),
    closed: () => false,
    diagnostics: () => ({ lateSettled: 0, lateRejected: 0, pending: 0 }),
  };
}
