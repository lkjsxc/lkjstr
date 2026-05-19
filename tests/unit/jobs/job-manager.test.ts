import { describe, expect, it } from 'vitest';
import { JobManager } from '../../../src/lib/jobs/job-manager';

describe('job manager', () => {
  it('persists state transitions to subscribers', async () => {
    const manager = new JobManager();
    const states: string[] = [];
    manager.subscribe((jobs) => states.push(jobs[0]?.status ?? 'empty'));

    const job = await manager.enqueue('notification-sync', { account: 'a' });
    await manager.setStatus(job.id, 'running');
    await manager.setStatus(job.id, 'completed');

    expect(states).toEqual(['empty', 'queued', 'running', 'completed']);
  });
});
