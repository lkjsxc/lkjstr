import { expect, test } from '@playwright/test';
import { openNewTabOption } from './workspace-helpers';
import { openCleanWorkspace } from './timeline-relay-helpers';

test('Stats compacts real IndexedDB cache under origin pressure', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({
          usage: 3 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        }),
      },
    });
  });
  await openCleanWorkspace(page);
  await openNewTabOption(page, 'Stats', 0);
  await expect(page.getByRole('heading', { name: 'Cache' })).toBeVisible();
  await seedPressureRows(page);
  await page.getByRole('button', { name: 'Refresh storage inventory' }).click();

  await expect(page.getByRole('cell', { name: 'nostr-event' })).toBeVisible();
  const before = await cacheCounts(page);
  expect(before.events).toBe(3);
  expect(before.protectedSettings).toBe(1);

  await page.getByRole('button', { name: 'Compact now' }).click();
  await expect
    .poll(async () => (await cacheCounts(page)).events, { timeout: 15_000 })
    .toBeLessThan(before.events);

  const after = await cacheCounts(page);
  expect(after.protectedSettings).toBe(1);
  expect(after.orphanLedgerRows).toBe(0);
  await expect(
    page.getByRole('cell', { name: 'protected-or-unknown-usage' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'unknown-only' })).toBeVisible();
});

async function seedPressureRows(page: Parameters<typeof cacheCounts>[0]) {
  await page.evaluate(async () => {
    const openDb = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('lkjstr');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const txDone = (tx: IDBTransaction) =>
      new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    const db = await openDb();
    const tx = db.transaction(
      [
        'events',
        'eventRelays',
        'eventTags',
        'cacheLedger',
        'cacheMeta',
        'settings',
      ],
      'readwrite',
    );
    tx.objectStore('settings').put({
      key: 'cache.maxBytes',
      namespace: 'cache',
      value: 1024 * 1024,
      updatedAt: Date.now(),
    });
    tx.objectStore('cacheMeta').put({
      id: 'main',
      budgetBytes: 1024 * 1024,
      updatedAt: Date.now(),
    });
    for (let index = 0; index < 3; index += 1) {
      const id = String(index + 1).repeat(64);
      const event = {
        id,
        pubkey: 'a'.repeat(64),
        created_at: index + 1,
        kind: 1,
        tags: [['e', `target-${index}`]],
        content: 'x'.repeat(2048),
        sig: 'f'.repeat(128),
        receivedAt: Date.now(),
        relayUrls: ['wss://relay.example'],
      };
      tx.objectStore('events').put(event);
      tx.objectStore('eventRelays').put({
        id: `${id}:relay`,
        eventId: id,
        relayUrl: 'wss://relay.example',
        receivedAt: Date.now(),
      });
      tx.objectStore('eventTags').put({
        id: `${id}:e:0`,
        eventId: id,
        tagName: 'e',
        tagValue: `target-${index}`,
        created_at: index + 1,
      });
      tx.objectStore('cacheLedger').put({
        id: `event:${id}`,
        ownerKind: 'event',
        resourceKind: 'nostr-event',
        resourceId: id,
        score: index,
        createdAt: index + 1,
        updatedAt: Date.now(),
        cacheBytes: 700_000,
        protected: false,
      });
    }
    await txDone(tx);
    db.close();
  });
}

async function cacheCounts(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const openDb = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('lkjstr');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const txDone = (tx: IDBTransaction) =>
      new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    const count = (store: IDBObjectStore) =>
      new Promise<number>((resolve, reject) => {
        const request = store.count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const all = (store: IDBObjectStore) =>
      new Promise<Record<string, string>[]>((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const db = await openDb();
    const tx = db.transaction(
      ['events', 'settings', 'cacheLedger'],
      'readonly',
    );
    const [events, protectedSettings, ledgerRows, eventRows] =
      await Promise.all([
        count(tx.objectStore('events')),
        count(tx.objectStore('settings')),
        all(tx.objectStore('cacheLedger')),
        all(tx.objectStore('events')),
      ]);
    await txDone(tx);
    db.close();
    const eventIds = new Set(eventRows.map((row) => row.id));
    return {
      events,
      protectedSettings,
      orphanLedgerRows: ledgerRows.filter(
        (row) =>
          row.resourceKind === 'nostr-event' && !eventIds.has(row.resourceId),
      ).length,
    };
  });
}
