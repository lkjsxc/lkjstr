import { describe, expect, it } from 'vitest';
import { createJobManager } from '../../../src/lib/jobs/job-manager';

describe('job manager', () => {
  it('persists state transitions to subscribers', async () => {
    const manager = createJobManager();
    const states: string[] = [];
    manager.subscribe((jobs) => states.push(jobs[0]?.status ?? 'empty'));

    const job = await manager.enqueue('notification-sync', { account: 'a' });
    await manager.setStatus(job.id, 'running');
    await manager.setStatus(job.id, 'completed');

    expect(states).toEqual(['empty', 'queued', 'running', 'completed']);
  });

  it('stores trees, progress, output, cancellation, and stale startup state', async () => {
    const manager = createJobManager();
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
    expect(await manager.markStaleStartupJobs(456)).toEqual([]);
  });

  it('hydrates persisted jobs and preserves terminal jobs during cancel tree', async () => {
    const manager = createJobManager();
    const root = await manager.enqueueRoot('paged-backfill');
    const complete = await manager.enqueueChild(root.id, 'relay-subscription');
    const queued = await manager.enqueueChild(root.id, 'relay-subscription');
    if (!complete || !queued) throw new Error('expected children');
    await manager.setStatus(complete.id, 'completed');

    const loaded = createJobManager();
    expect(await loaded.load()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: root.id })]),
    );
    await loaded.cancelTree(root.id, 'test');
    const tree = await loaded.listTree(root.id);

    const completed = tree.find((job) => job.id === complete.id);
    expect(completed).toMatchObject({ status: 'completed' });
    expect(completed).not.toHaveProperty('cancelRequestedAt');
    expect(completed).not.toHaveProperty('canceledBy');
    expect(tree.find((job) => job.id === queued.id)).toMatchObject({
      status: 'canceled',
      canceledBy: 'test',
    });
  });
});
