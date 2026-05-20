import type { JobKind, JobRecord, JobStatus } from '../events/types';

export type JobSeed = {
  readonly id: string;
  readonly kind: JobKind;
  readonly input: unknown;
  readonly label?: string;
  readonly parentId?: string;
  readonly rootId: string;
  readonly path?: readonly string[];
};

export function baseJob(seed: JobSeed): JobRecord {
  const now = Date.now();
  return {
    id: seed.id,
    kind: seed.kind,
    status: 'queued',
    input: seed.input,
    label: seed.label,
    parentId: seed.parentId,
    rootId: seed.rootId,
    path: seed.path ?? [seed.id],
    createdAt: now,
    updatedAt: now,
  };
}

export function terminalJobStatus(status: JobStatus): boolean {
  return ['completed', 'failed', 'canceled'].includes(status);
}
