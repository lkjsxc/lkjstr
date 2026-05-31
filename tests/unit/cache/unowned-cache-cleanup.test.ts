import { afterEach, describe, expect, it, vi } from 'vitest';

describe('unowned cache cleanup', () => {
  afterEach(() => vi.resetModules());

  it('deletes event relay and tag rows whose event is gone', async () => {
    const relays = table([
      { id: 'relay:kept', eventId: 'kept' },
      { id: 'relay:missing', eventId: 'missing' },
    ]);
    const tags = table([
      { id: 'tag:kept', eventId: 'kept' },
      { id: 'tag:missing', eventId: 'missing' },
    ]);
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => ({
        eventRelays: relays,
        eventTags: tags,
        events: { get: async (id: string) => (id === 'kept' ? { id } : null) },
      }),
    }));
    const cleanup =
      await import('../../../src/lib/cache/unowned-cache-cleanup');
    await expect(cleanup.deleteUnownedCacheRows()).resolves.toBe(2);
    expect(relays.deleted).toEqual(['relay:missing']);
    expect(tags.deleted).toEqual(['tag:missing']);
  });
});

function table(
  rows: readonly { readonly id: string; readonly eventId: string }[],
) {
  const deleted: string[] = [];
  return {
    deleted,
    each: async (
      visit: (row: { readonly id: string; readonly eventId: string }) => void,
    ) => {
      rows.forEach(visit);
    },
    bulkDelete: async (ids: readonly string[]) => {
      deleted.push(...ids);
    },
  };
}
