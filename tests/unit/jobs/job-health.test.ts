import { describe, expect, it } from 'vitest';
import { jobHealthSummary } from '../../../src/lib/jobs/job-health';
import type { JobRecord } from '../../../src/lib/events/types';

describe('job health summary', () => {
  it('derives counts, oldest queued age, failures, and stale startup marks', () => {
    const summary = jobHealthSummary(
      [
        job('root', 'queued', 1000, 1000),
        job('child', 'running', 2000, 3000, { rootId: 'root' }),
        job('failed', 'failed', 1500, 5000, { error: 'boom' }),
        job('stale', 'failed', 1200, 6000, { staleStartedAt: 5500 }),
      ],
      7000,
    );

    expect(summary.statusCounts).toMatchObject({
      queued: 1,
      running: 1,
      failed: 2,
    });
    expect(summary.rootCounts).toMatchObject({ queued: 1, failed: 2 });
    expect(summary.oldestQueuedAgeMs).toBe(6000);
    expect(summary.latestFailure?.id).toBe('failed');
    expect(summary.latestStaleStartupMark?.id).toBe('stale');
  });
});

function job(
  id: string,
  status: JobRecord['status'],
  createdAt: number,
  updatedAt: number,
  patch: Partial<JobRecord> = {},
): JobRecord {
  return {
    id,
    kind: 'relay-subscription',
    status,
    input: {},
    rootId: id,
    path: [id],
    createdAt,
    updatedAt,
    ...patch,
  };
}
