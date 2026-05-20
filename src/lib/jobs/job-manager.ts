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
import { baseJob, terminalJobStatus } from './job-record';

const memoryJobs = new Map<string, JobRecord>();

export class JobManager {
  #listeners = new Set<(jobs: readonly JobRecord[]) => void>();

  subscribe(listener: (jobs: readonly JobRecord[]) => void): () => void {
    this.#listeners.add(listener);
    this.#emit();
    return () => this.#listeners.delete(listener);
  }

  async enqueue(
    kind: JobKind,
    input: unknown = {},
    label?: string,
  ): Promise<JobRecord> {
    return this.enqueueRoot(kind, input, label);
  }

  async enqueueRoot(
    kind: JobKind,
    input: unknown = {},
    label?: string,
  ): Promise<JobRecord> {
    const id = crypto.randomUUID();
    return this.#save(baseJob({ id, kind, input, label, rootId: id }));
  }

  async enqueueChild(
    parentId: string,
    kind: JobKind,
    input: unknown = {},
    label?: string,
  ): Promise<JobRecord | undefined> {
    const parent = await this.#get(parentId);
    if (!parent) return undefined;
    const id = crypto.randomUUID();
    return this.#save(
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
  }

  async setStatus(
    id: string,
    status: JobStatus,
    error?: string,
  ): Promise<JobRecord | undefined> {
    const job = await this.#get(id);
    if (!job) return undefined;
    return this.#save({
      ...job,
      status,
      error,
      updatedAt: Date.now(),
      completedAt: ['completed', 'failed', 'canceled'].includes(status)
        ? Date.now()
        : job.completedAt,
    });
  }

  cancel(id: string): Promise<JobRecord | undefined> {
    return this.setStatus(id, 'canceled');
  }

  async updateProgress(
    id: string,
    progress: JobProgress,
  ): Promise<JobRecord | undefined> {
    const job = await this.#get(id);
    if (!job) return undefined;
    return this.#save({ ...job, progress, updatedAt: Date.now() });
  }

  async appendOutput(id: string, line: string): Promise<JobRecord | undefined> {
    const job = await this.#get(id);
    return job
      ? this.#save({
          ...job,
          output: [...(job.output ?? []), line].slice(-100),
          updatedAt: Date.now(),
        })
      : undefined;
  }

  async cancelTree(
    id: string,
    canceledBy = 'user',
  ): Promise<readonly JobRecord[]> {
    const root = await this.#get(id);
    if (!root) return [];
    const records = await this.listTree(root.rootId);
    const now = Date.now();
    const next = records.map((job) => ({
      ...job,
      status: terminalJobStatus(job.status) ? job.status : 'canceled',
      cancelRequestedAt: job.cancelRequestedAt ?? now,
      canceledBy,
      updatedAt: now,
      completedAt: job.completedAt ?? now,
    }));
    await Promise.all(next.map((job) => this.#save(job)));
    return next;
  }

  async list(): Promise<JobRecord[]> {
    return boundedStorageRead(
      () => browserDb().jobs.toArray(),
      [...memoryJobs.values()],
    );
  }

  async listTree(rootId?: string): Promise<JobRecord[]> {
    const jobs = await this.list();
    return jobs
      .filter((job) => !rootId || job.rootId === rootId)
      .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
  }

  async markStaleStartupJobs(now = Date.now()): Promise<JobRecord[]> {
    const stale = (await this.list()).filter((job) =>
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
    await Promise.all(updated.map((job) => this.#save(job)));
    return updated;
  }

  async #get(id: string): Promise<JobRecord | undefined> {
    return (
      memoryJobs.get(id) ??
      (await browserDb()
        .jobs.get(id)
        .catch(() => undefined))
    );
  }

  async #save(job: JobRecord): Promise<JobRecord> {
    memoryJobs.set(job.id, job);
    await bestEffortStorageWrite(() => browserDb().jobs.put(job));
    this.#emit();
    return job;
  }

  #emit(): void {
    const jobs = [...memoryJobs.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    this.#listeners.forEach((listener) => listener(jobs));
  }
}

export const sharedJobManager = new JobManager();
