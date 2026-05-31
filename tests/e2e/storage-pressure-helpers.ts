import type { Page } from '@playwright/test';

export async function seedPressureRows(page: Page) {
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
    const tx = db.transaction([...seedStores], 'readwrite');
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
    seedProtectedRows(tx);
    seedEventRows(tx);
    await txDone(tx);
    db.close();
  });
}

export async function cacheCounts(page: Page) {
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
    const db = await openDb();
    const tx = db.transaction([...countStores], 'readonly');
    const counts = await readCounts(tx);
    await txDone(tx);
    db.close();
    return counts;
  });
}

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
] as const;

const countStores = [
  'events',
  'localAccountSecrets',
  'relaySets',
  'settings',
  'workspaces',
  'cacheLedger',
] as const;

function seedProtectedRows(tx: IDBTransaction): void {
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
}

function seedEventRows(tx: IDBTransaction): void {
  for (let index = 0; index < 3; index += 1) {
    const id = String(index + 1).repeat(64);
    tx.objectStore('events').put({
      id,
      pubkey: 'a'.repeat(64),
      created_at: index + 1,
      kind: 1,
      tags: [['e', `target-${index}`]],
      content: 'x'.repeat(2048),
      sig: 'f'.repeat(128),
      receivedAt: Date.now(),
      relayUrls: ['wss://relay.example'],
    });
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
}

async function readCounts(tx: IDBTransaction) {
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
}

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
