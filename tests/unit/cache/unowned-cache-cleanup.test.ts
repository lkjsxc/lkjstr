import { afterEach, describe, expect, it, vi } from 'vitest';

describe('unowned cache cleanup', () => {
  afterEach(() => vi.resetModules());

  it('deletes event relay and tag rows whose event is gone', async () => {
    const statements: string[] = [];
    vi.doMock('../../../src/lib/storage/sqlite-opfs/event-schema', () => ({
      ensureEventGraphSchema: async () => true,
    }));
    vi.doMock('../../../src/lib/storage/sqlite-opfs/kernel-client', () => ({
      sendSqliteStorage: async (op: { readonly statement?: string }) => {
        statements.push(op.statement ?? '');
        return { outcome: 'ok', rowsAffected: 1 };
      },
    }));
    const cleanup =
      await import('../../../src/lib/cache/unowned-cache-cleanup');

    await expect(cleanup.deleteUnownedCacheRows()).resolves.toBe(2);
    expect(statements).toEqual([
      'DELETE FROM event_relays WHERE event_id NOT IN (SELECT id FROM events);',
      'DELETE FROM event_tags WHERE event_id NOT IN (SELECT id FROM events);',
    ]);
  });
});
