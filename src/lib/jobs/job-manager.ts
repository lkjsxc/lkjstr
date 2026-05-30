import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import type {
  JobKind,
  JobProgress,
  JobRecord,
  JobStatus,
} from '../events/types';
import { createBoundedMap } from '../fp/bounded-map';
import { jobLedgerRecord } from './job-ledger';
import { baseJob, terminalJobStatus } from './job-record';

const memoryJobs = createBoundedMap<string, JobRecord>({ maxSize: 500 });

export type JobManager = ReturnType<typeof createJobManager>;

export function createJobManager() {
  const listeners = new Set<(jobs: readonly JobRecord[]) => void>();
  let staleStartupMarked = false;

  const emit = (): void => {
    const jobs = [...memoryJobs.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    listeners.forEach((listener) => listener(jobs));
  };
  const get = async (id: string): Promise<JobRecord | undefined> =>
    memoryJobs.get(id) ??
    (await browserDb()
      .jobs.get(id)
      .catch(() => undefined));
  const save = async (job: JobRecord): Promise<JobRecord> => {
    memoryJobs.set(job.id, job);
    await bestEffortStorageWrite(() =>
      browserDb().transaction(
        'rw',
        browserDb().jobs,
        browserDb().cacheLedger,
        async () => {
          await browserDb().jobs.put(job);
          await browserDb().cacheLedger.put(jobLedgerRecord(job));
        },
      ),
    );
    emit();
    return job;
  };

  const manager = {
    subscribe: (
      listener: (jobs: readonly JobRecord[]) => void,
    ): (() => void) => {
      listeners.add(listener);
      emit();
      return () => listeners.delete(listener);
    },
    enqueue: (
      kind: JobKind,
      input: unknown = {},
      label?: string,
    ): Promise<JobRecord> => manager.enqueueRoot(kind, input, label),
    load: async (): Promise<JobRecord[]> => {
      const jobs = await manager.list();
      memoryJobs.clear();
      for (const job of jobs) memoryJobs.set(job.id, job);
      emit();
      return jobs;
    },
    enqueueRoot: (
      kind: JobKind,
      input: unknown = {},
      label?: string,
    ): Promise<JobRecord> => {
      const id = crypto.randomUUID();
      return save(baseJob({ id, kind, input, label, rootId: id }));
    },
    enqueueChild: async (
      parentId: string,
      kind: JobKind,
      input: unknown = {},
      label?: string,
    ): Promise<JobRecord | undefined> => {
      const parent = await get(parentId);
      if (!parent) return undefined;
      const id = crypto.randomUUID();
      return save(
        baseJob({
          id,
          kind,
          input,
          label,
          parentId,
          rootId: parent.rootId,
          path: [...parent.path, id],
        }),
      );
    },
    setStatus: async (
      id: string,
      status: JobStatus,
      error?: string,
    ): Promise<JobRecord | undefined> => {
      const job = await get(id);
      if (!job) return undefined;
      return save({
        ...job,
        status,
        error,
        updatedAt: Date.now(),
        completedAt: ['completed', 'failed', 'canceled'].includes(status)
          ? Date.now()
          : job.completedAt,
      });
    },
    cancel: (id: string): Promise<JobRecord | undefined> =>
      manager.setStatus(id, 'canceled'),
    updateProgress: async (
      id: string,
      progress: JobProgress,
    ): Promise<JobRecord | undefined> => {
      const job = await get(id);
      return job
        ? save({ ...job, progress, updatedAt: Date.now() })
        : undefined;
    },
    appendOutput: async (
      id: string,
      line: string,
    ): Promise<JobRecord | undefined> => {
      const job = await get(id);
      return job
        ? save({
            ...job,
            output: [...(job.output ?? []), line].slice(-100),
            updatedAt: Date.now(),
          })
        : undefined;
    },
    cancelTree: async (
      id: string,
      canceledBy = 'user',
    ): Promise<readonly JobRecord[]> => {
      const root = await get(id);
      if (!root) return [];
      const records = await manager.listTree(root.rootId);
      const now = Date.now();
      const next = records.map((job) =>
        terminalJobStatus(job.status)
          ? job
          : {
              ...job,
              status: 'canceled' as const,
              cancelRequestedAt: job.cancelRequestedAt ?? now,
              canceledBy,
              updatedAt: now,
              completedAt: now,
            },
      );
      await Promise.all(
        next
          .filter((job, index) => job !== records[index])
          .map((job) => save(job)),
      );
      return next;
    },
    list: (): Promise<JobRecord[]> =>
      boundedStorageRead(
        () =>
          browserDb().jobs.orderBy('updatedAt').reverse().limit(5000).toArray(),
        [...memoryJobs.values()],
      ),
    listTree: async (rootId?: string): Promise<JobRecord[]> =>
      (await manager.list())
        .filter((job) => !rootId || job.rootId === rootId)
        .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/'))),
    markStaleStartupJobs: async (now = Date.now()): Promise<JobRecord[]> => {
      if (staleStartupMarked) return [];
      staleStartupMarked = true;
      const stale = (await manager.list()).filter((job) =>
        ['queued', 'running'].includes(job.status),
      );
      const updated = stale.map((job) => ({
        ...job,
        status: 'failed' as const,
        error: job.error ?? 'Job stopped during startup.',
        staleStartedAt: now,
        updatedAt: now,
        completedAt: now,
      }));
      await Promise.all(updated.map((job) => save(job)));
      return updated;
    },
  };
  return manager;
}

export const sharedJobManager = createJobManager();
