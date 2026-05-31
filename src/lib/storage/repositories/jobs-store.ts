import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { JobRecord } from '../../events/types';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function readJobRow(id: string): Promise<JobRecord | undefined> {
  return boundedStorageRead(() => browserDb().jobs.get(id), undefined);
}

export async function putJobRowWithLedger(
  job: JobRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['jobs', 'cacheLedger'],
    purpose: 'job-write',
    run: async (db) => {
      await db.jobs.put(job);
      await db.cacheLedger.put(ledgerRow);
    },
  });
}

export async function readRecentJobRows(
  fallback: readonly JobRecord[],
): Promise<JobRecord[]> {
  return boundedStorageRead(
    () => browserDb().jobs.orderBy('updatedAt').reverse().limit(5000).toArray(),
    [...fallback],
  );
}
