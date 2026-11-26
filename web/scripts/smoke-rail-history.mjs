// Populate the same durable event records the Worker reads on a warm boot.
import { createHash } from 'node:crypto';

export function verifiedRecord(event) {
  const { id, pubkey, created_at, kind, tags, content, sig } = event;
  const raw = JSON.stringify([1, id, pubkey, created_at, kind, tags, content, sig]);
  const receipt = `lkjstr-verified-1:${createHash('sha256').update(raw).digest('hex')}`;
  return { id, created_at, kind, raw, receipt };
}

export const commitRailHistory = (page, records, { evicted = [], sample = [] } = {}) =>
  page.evaluate(
    ({ records, evicted, sample }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lkjstr-wasm');
        open.onerror = () => reject(open.error);
        open.onsuccess = async () => {
          const db = open.result;
          const write = (update) =>
            new Promise((done, fail) => {
              const transaction = db.transaction('events', 'readwrite');
              const result = update(transaction.objectStore('events'));
              transaction.oncomplete = () => done(result);
              transaction.onabort = () => fail(transaction.error);
            });
          try {
            const before = await write((store) => {
              for (const record of records) store.put(record);
              return { count: store.count(), evictedKeys: evicted.map((id) => store.getKey(id)) };
            });
            const after = await write((store) => {
              for (const id of evicted) store.delete(id);
              return {
                count: store.count(),
                evictedKeys: evicted.map((id) => store.getKey(id)),
                sampleKeys: sample.map((id) => store.getKey(id)),
              };
            });
            resolve({
              storedBefore: before.count.result,
              committed: after.count.result,
              evictionPrepared: before.evictedKeys.every((request) => request.result !== undefined),
              removed: after.evictedKeys.every((request) => request.result === undefined),
              retained: after.sampleKeys.every((request) => request.result !== undefined),
            });
          } catch (error) {
            reject(error);
          } finally {
            db.close();
          }
        };
      }),
    { records, evicted, sample },
  );
