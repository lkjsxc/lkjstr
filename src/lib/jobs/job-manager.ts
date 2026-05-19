import { browserDb } from '../storage/browser-db';
import type { JobKind, JobRecord, JobStatus } from '../events/types';

const memoryJobs = new Map<string, JobRecord>();

export class JobManager {
  #listeners = new Set<(jobs: readonly JobRecord[]) => void>();

  subscribe(listener: (jobs: readonly JobRecord[]) => void): () => void {
    this.#listeners.add(listener);
    this.#emit();
    return () => this.#listeners.delete(listener);
  }

  async enqueue(kind: JobKind, input: unknown = {}): Promise<JobRecord> {
    return this.#save({
      id: crypto.randomUUID(),
      kind,
      status: 'queued',
      input,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  async setStatus(
    id: string,
    status: JobStatus,
    error?: string,
  ): Promise<JobRecord | undefined> {
    const job =
      memoryJobs.get(id) ??
      (await browserDb()
        .jobs.get(id)
        .catch(() => undefined));
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

  async list(): Promise<JobRecord[]> {
    if (typeof indexedDB === 'undefined') return [...memoryJobs.values()];
    return browserDb()
      .jobs.toArray()
      .catch(() => [...memoryJobs.values()]);
  }

  async #save(job: JobRecord): Promise<JobRecord> {
    memoryJobs.set(job.id, job);
    if (typeof indexedDB !== 'undefined')
      await browserDb()
        .jobs.put(job)
        .catch(() => undefined);
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
