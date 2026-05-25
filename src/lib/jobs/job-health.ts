import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';
import type { JobRecord, JobStatus } from '../events/types';

export type JobHealthSummary = {
  readonly updatedAt: number;
  readonly total: number;
  readonly statusCounts: Record<JobStatus, number>;
  readonly rootCounts: Record<JobStatus, number>;
  readonly oldestQueuedAgeMs?: number;
  readonly latestFailure?: JobRecord;
  readonly latestStaleStartupMark?: JobRecord;
};

const emptyCounts: Record<JobStatus, number> = {
  queued: 0,
  running: 0,
  completed: 0,
  failed: 0,
  canceled: 0,
};

export async function loadJobHealthSummary(
  now = Date.now(),
): Promise<JobHealthSummary> {
  const jobs = await boundedStorageRead(
    () => browserDb().jobs.orderBy('updatedAt').reverse().limit(5000).toArray(),
    [],
  );
  return jobHealthSummary(jobs, now);
}

export function jobHealthSummary(
  jobs: readonly JobRecord[],
  now = Date.now(),
): JobHealthSummary {
  const statusCounts = { ...emptyCounts };
  const rootCounts = { ...emptyCounts };
  for (const job of jobs) {
    statusCounts[job.status] += 1;
    if (job.rootId === job.id) rootCounts[job.status] += 1;
  }
  const queued = jobs
    .filter((job) => job.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  return {
    updatedAt: now,
    total: jobs.length,
    statusCounts,
    rootCounts,
    oldestQueuedAgeMs: queued ? now - queued.createdAt : undefined,
    latestFailure: latest(
      jobs.filter((job) => job.status === 'failed' && !job.staleStartedAt),
    ),
    latestStaleStartupMark: latest(
      jobs.filter((job) => Boolean(job.staleStartedAt)),
    ),
  };
}

function latest(jobs: readonly JobRecord[]): JobRecord | undefined {
  return [...jobs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
