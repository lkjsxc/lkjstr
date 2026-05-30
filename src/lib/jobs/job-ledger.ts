import { encodedJsonBytes } from '../cache/cache-byte-size';
import { cacheLedgerBytes } from '../cache/cache-ledger-bytes';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import type { JobRecord } from '../events/types';
import { terminalJobStatus } from './job-record';

export function jobLedgerRecord(job: JobRecord): CacheLedgerRecord {
  const protectedJob = !terminalJobStatus(job.status);
  const baseScore = job.status === 'failed' ? 250 : 100;
  const draft: CacheLedgerRecord = {
    id: cacheLedgerId('job', job.id),
    ownerKind: 'job',
    resourceKind: 'job-record',
    resourceId: job.id,
    score: baseScore + Math.floor(job.updatedAt / 3_600_000),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    cacheBytes: 0,
    protected: protectedJob,
    reason: protectedJob ? 'active-job' : 'finished-job',
  };
  return {
    ...draft,
    cacheBytes: encodedJsonBytes(job) + cacheLedgerBytes(draft),
  };
}
