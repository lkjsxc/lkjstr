import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { JobRecord } from '../../events/types';
import {
  sqlitePutJobWithLedger,
  sqliteReadJob,
  sqliteReadRecentJobs,
} from '../sqlite-opfs/jobs-sqlite';

export async function readJobRow(id: string): Promise<JobRecord | undefined> {
  return sqliteReadJob(id).catch(() => undefined);
}

export async function putJobRowWithLedger(
  job: JobRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<void> {
  await sqlitePutJobWithLedger(job, ledgerRow).catch(() => false);
}

export async function readRecentJobRows(
  fallback: readonly JobRecord[],
): Promise<JobRecord[]> {
  return (await sqliteReadRecentJobs().catch(() => undefined)) ?? [...fallback];
}
