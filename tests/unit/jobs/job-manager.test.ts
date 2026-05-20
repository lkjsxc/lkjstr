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

  it('stores trees, progress, output, cancellation, and stale startup state', async () => {
    const manager = new JobManager();
    const root = await manager.enqueueRoot('paged-backfill', {}, 'Backfill');
    const child = await manager.enqueueChild(root.id, 'relay-subscription');
    if (!child) throw new Error('expected child');

    await manager.updateProgress(child.id, { current: 1, total: 2 });
    await manager.appendOutput(child.id, 'connected');
    const tree = await manager.listTree(root.id);

    expect(tree.map((job) => job.id)).toEqual([root.id, child.id]);
    expect(tree[1]).toMatchObject({
      rootId: root.id,
      parentId: root.id,
      progress: { current: 1, total: 2 },
      output: ['connected'],
    });

    await manager.cancelTree(root.id, 'test');
    expect((await manager.listTree(root.id)).map((job) => job.status)).toEqual([
      'canceled',
      'canceled',
    ]);

    const stale = await manager.enqueue('notification-sync');
    await manager.setStatus(stale.id, 'running');
    const [marked] = await manager.markStaleStartupJobs(123);
    expect(marked).toMatchObject({
      id: stale.id,
      status: 'failed',
      staleStartedAt: 123,
    });
  });
});
