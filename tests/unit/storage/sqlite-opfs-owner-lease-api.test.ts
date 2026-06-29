import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  acquireSqliteOpfsOwnerLease,
  sqliteOwnerLockName,
} from '../../../src/lib/storage/sqlite-opfs/owner-lease';

describe('SQLite OPFS Web Locks owner lease', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('holds the exclusive Web Lock until release', async () => {
    let released = false;
    vi.stubGlobal('navigator', {
      locks: {
        request: async (
          name: string,
          options: unknown,
          callback: (lock: unknown) => Promise<void>,
        ) => {
          expect(name).toBe(sqliteOwnerLockName);
          expect(options).toMatchObject({
            mode: 'exclusive',
            ifAvailable: true,
          });
          await callback({ name });
          released = true;
        },
      },
    });

    const result = await acquireSqliteOpfsOwnerLease();

    expect(result.ok).toBe(true);
    expect(released).toBe(false);
    if (result.ok) result.lease.release();
    await Promise.resolve();
    expect(released).toBe(true);
  });

  test('reports busy when Web Lock ifAvailable returns null', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: (lock: unknown) => void,
        ) => {
          callback(null);
        },
      },
    });

    const result = await acquireSqliteOpfsOwnerLease();

    expect(result).toMatchObject({
      ok: false,
      denied: {
        outcome: 'busy',
        diagnostics: { ownerReason: 'web-lock-held' },
      },
    });
  });
});
