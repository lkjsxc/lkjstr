import type { Page } from '@playwright/test';

const seedStores = [
  'events',
  'eventRelays',
  'eventTags',
  'cacheLedger',
  'cacheMeta',
  'localAccountSecrets',
  'relaySets',
  'settings',
  'workspaces',
];

const countStores = [
  'events',
  'localAccountSecrets',
  'relaySets',
  'settings',
  'workspaces',
  'cacheLedger',
];

export async function seedPressureRows(page: Page) {
  await page.evaluate(async (stores) => {
    const db = await openDb();
    const tx = db.transaction(stores, 'readwrite');
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
    tx.objectStore('localAccountSecrets').put({
      accountId: 'local',
      pubkey: 'b'.repeat(64),
      encryptedSecret: 'secret',
      updatedAt: Date.now(),
    });
    tx.objectStore('workspaces').put({
      id: 'main',
      root: { kind: 'tile', id: 'tile', tabs: [], activeTabId: null },
      updatedAt: Date.now(),
    });
    tx.objectStore('relaySets').put({
      id: 'default',
      name: 'Default',
      relays: [],
      updatedAt: Date.now(),
      seeded: false,
    });
    for (let index = 0; index < 3; index += 1) {
      const id = String(index + 1).repeat(64);
      tx.objectStore('events').put(eventRow(id, index));
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
      tx.objectStore('cacheLedger').put(ledgerRow(id, index));
    }
    await txDone(tx);
    db.close();

    function eventRow(id: string, index: number) {
      return {
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
    }
    function ledgerRow(id: string, index: number) {
      return {
        id: `event:${id}`,
        ownerKind: 'event',
        resourceKind: 'nostr-event',
        resourceId: id,
        score: index,
        createdAt: index + 1,
        updatedAt: Date.now(),
        cacheBytes: 700_000,
        protected: false,
      };
    }
    function openDb(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('lkjstr');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }
    function txDone(tx: IDBTransaction): Promise<void> {
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }, seedStores);
}

export async function cacheCounts(page: Page) {
  return page.evaluate(async (stores) => {
    function count(store: IDBObjectStore): Promise<number> {
      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }
    function all(store: IDBObjectStore): Promise<Record<string, string>[]> {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }
    function openDb(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('lkjstr');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }
    function txDone(tx: IDBTransaction): Promise<void> {
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    const db = await openDb();
    const tx = db.transaction(stores, 'readonly');
    const [events, settings, secrets, workspaces, relaySets, ledgerRows] =
      await Promise.all([
        count(tx.objectStore('events')),
        count(tx.objectStore('settings')),
        count(tx.objectStore('localAccountSecrets')),
        count(tx.objectStore('workspaces')),
        count(tx.objectStore('relaySets')),
        all(tx.objectStore('cacheLedger')),
      ]);
    const eventRows = await all(tx.objectStore('events'));
    await txDone(tx);
    db.close();
    const eventIds = new Set(eventRows.map((row) => row.id));
    return {
      events,
      protectedSettings: settings,
      protectedSecrets: secrets,
      protectedWorkspaces: workspaces,
      protectedRelaySets: relaySets,
      orphanLedgerRows: ledgerRows.filter(
        (row) =>
          row.resourceKind === 'nostr-event' && !eventIds.has(row.resourceId),
      ).length,
    };
  }, countStores);
}
