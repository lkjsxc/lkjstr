import { browserDb } from '../storage/browser-db';
import { visitStorageRows } from '../storage/ledger/table-scan';

const DELETE_BATCH_SIZE = 100;

export async function deleteUnownedCacheRows(): Promise<number> {
  const relayRows = await deleteRowsWithoutEvent(
    browserDb().eventRelays,
    (row) => row.eventId,
  );
  const tagRows = await deleteRowsWithoutEvent(
    browserDb().eventTags,
    (row) => row.eventId,
  );
  return relayRows + tagRows;
}

async function deleteRowsWithoutEvent<T extends { readonly id: string }>(
  table: {
    readonly bulkDelete: (ids: string[]) => Promise<unknown>;
    readonly each: (visit: (row: T) => void) => Promise<void>;
  },
  eventId: (row: T) => string,
): Promise<number> {
  let deleted = 0;
  const ids: string[] = [];
  await visitStorageRows(table, async (row) => {
    if (await browserDb().events.get(eventId(row))) return;
    ids.push(row.id);
    deleted += 1;
    if (ids.length >= DELETE_BATCH_SIZE) await flushDeletes(table, ids);
  });
  await flushDeletes(table, ids);
  return deleted;
}

async function flushDeletes(
  table: { readonly bulkDelete: (ids: string[]) => Promise<unknown> },
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await table.bulkDelete(ids.splice(0, ids.length));
}
