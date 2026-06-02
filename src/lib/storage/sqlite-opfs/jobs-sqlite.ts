import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { JobRecord } from '../../events/types';
import { ensureRelayCacheSchema } from './relay-cache-schema';
import {
  cacheLedgerSqlStep,
  sqliteRecordBatch,
  sqliteRecordReadMany,
  sqliteRecordReadOne,
} from './sqlite-record-helpers';
import type { SqlStep } from './types';

export function sqliteReadJob(id: string): Promise<JobRecord | undefined> {
  return sqliteRecordReadOne<JobRecord>(
    ensureRelayCacheSchema,
    'jobs',
    'id = ?1',
    [id],
  );
}

export function sqliteReadRecentJobs(): Promise<JobRecord[] | undefined> {
  return sqliteRecordReadMany<JobRecord>(
    ensureRelayCacheSchema,
    'jobs',
    '1 = 1 ORDER BY updated_at_ms DESC',
    [],
    5000,
  );
}

export function sqlitePutJobWithLedger(
  job: JobRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<boolean> {
  return sqliteRecordBatch(ensureRelayCacheSchema, [
    jobStep(job),
    cacheLedgerSqlStep(ledgerRow),
  ]);
}

function jobStep(job: JobRecord): SqlStep {
  return {
    statement:
      'INSERT INTO jobs (id, root_id, parent_id, kind, status, record_json, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(id) DO UPDATE SET root_id = excluded.root_id, parent_id = excluded.parent_id, kind = excluded.kind, status = excluded.status, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      job.id,
      job.rootId,
      job.parentId ?? null,
      job.kind,
      job.status,
      JSON.stringify(job),
      job.createdAt,
      job.updatedAt,
    ],
  };
}
