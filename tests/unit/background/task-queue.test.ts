import { describe, expect, it } from 'vitest';
import { createBackgroundTaskQueue } from '../../../src/lib/background/task-queue';
import type { BackgroundTask } from '../../../src/lib/background/task-types';

function queue() {
  let now = 0;
  return createBackgroundTaskQueue({
    maxQueued: 2,
    maxConcurrentUserVisible: 1,
    maxConcurrentMaintenance: 1,
    maxEvents: 8,
    now: () => now++,
  });
}

describe('background task queue', () => {
  it('runs user-visible and maintenance tasks under separate caps', async () => {
    const q = queue();
    const order: string[] = [];
    q.enqueue(
      task('a', 'owner', 'user-visible', async () => {
        order.push('a');
      }),
    );
    q.enqueue(
      task('b', 'owner', 'maintenance', async () => {
        order.push('b');
      }),
    );
    await tick();
    expect(order.sort()).toEqual(['a', 'b']);
    expect(q.snapshot()).toMatchObject({ completed: 2, active: 0 });
  });

  it('cancels queued and active work by owner', async () => {
    const q = queue();
    const gate = deferred<void>();
    q.enqueue(
      task('a', 'tab-1', 'user-visible', async ({ signal }) => {
        await gate.promise;
        expect(signal.aborted).toBe(true);
      }),
    );
    q.enqueue(task('b', 'tab-1', 'user-visible', async () => undefined));
    q.cancelOwner('tab-1');
    gate.resolve();
    await tick();
    expect(q.snapshot()).toMatchObject({ cancelled: 2, completed: 0 });
  });

  it('drops idle work before rejecting visible work when full', async () => {
    const q = queue();
    const userGate = deferred<void>();
    const maintenanceGate = deferred<void>();
    q.enqueue(task('maint', 'o', 'maintenance', () => maintenanceGate.promise));
    q.enqueue(task('idle', 'o', 'idle', async () => undefined));
    q.enqueue(task('active', 'o', 'user-visible', () => userGate.promise));
    q.enqueue(task('near', 'o', 'near-visible', async () => undefined));
    const accepted = q.enqueue(
      task('visible', 'o', 'user-visible', async () => undefined),
    );
    userGate.resolve();
    maintenanceGate.resolve();
    await tick();
    expect(accepted).toBe(true);
    expect(q.snapshot().dropped).toBe(1);
  });

  it('rejects duplicate active tasks and closes idempotently', async () => {
    const q = queue();
    const gate = deferred<void>();
    q.enqueue(task('active', 'o', 'user-visible', () => gate.promise));
    expect(
      q.enqueue(task('active', 'o', 'user-visible', async () => undefined)),
    ).toBe(false);
    q.close();
    q.close();
    gate.resolve();
    await tick();
    expect(q.snapshot().rejected).toBe(1);
  });
});

function task(
  id: string,
  owner: string,
  priority: BackgroundTask['priority'],
  run: BackgroundTask['run'],
): BackgroundTask {
  return { id, owner, priority, run };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
