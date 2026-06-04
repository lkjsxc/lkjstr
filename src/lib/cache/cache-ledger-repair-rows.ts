import type { CacheLedgerRecord } from './cache-ledger-record';
import { collectSqliteRepairRows } from '../storage/sqlite-opfs/cache-ledger-repair-rows-sqlite';

const REPAIR_CHUNK_LIMIT = 250;

export async function collectRepairRows(
  visit: (record: CacheLedgerRecord) => Promise<void>,
): Promise<void> {
  await collectSqliteRepairRows(visit, REPAIR_CHUNK_LIMIT);
}
