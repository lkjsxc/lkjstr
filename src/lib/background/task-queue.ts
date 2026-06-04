import { errorReason } from './errors';
import { isBackgroundTaskCancelled, throwIfAborted } from './cancellation';
import { backgroundYield } from './yield';
import type {
  BackgroundTask,
  BackgroundTaskEvent,
  BackgroundTaskHandle,
  BackgroundTaskPriority,
  BackgroundTaskSnapshot,
} from './task-types';

export type BackgroundTaskQueueOptions = {
  readonly maxQueued: number;
  readonly maxConcurrentUserVisible: number;
  readonly maxConcurrentMaintenance: number;
  readonly maxEvents: number;
  readonly now: () => number;
};

type QueuedTask = { readonly task: BackgroundTask; readonly queuedAt: number };
type ActiveTask = {
  readonly task: BackgroundTask;
  readonly controller: AbortController;
};

type MutableCounts = {
  completed: number;
  failed: number;
  cancelled: number;
  dropped: number;
  rejected: number;
};

export function createBackgroundTaskQueue(
  options: BackgroundTaskQueueOptions,
): BackgroundTaskHandle {
  const queued: QueuedTask[] = [];
  const active = new Map<string, ActiveTask>();
  const events: BackgroundTaskEvent[] = [];
  const counts: MutableCounts = emptyCounts();
  let closed = false;

  const enqueue = (task: BackgroundTask): boolean => {
    if (closed) return reject(task, 'queue closed');
    const existing = queued.findIndex((item) => item.task.id === task.id);
    if (existing >= 0) {
      queued.splice(existing, 1, { task, queuedAt: options.now() });
      push(event(task, 'replaced'));
      schedule();
      return true;
    }
    if (active.has(task.id)) return reject(task, 'task already active');
    if (queued.length >= options.maxQueued && !dropIdle(task))
      return reject(task, 'queue full');
    queued.push({ task, queuedAt: options.now() });
    push(event(task, 'queued'));
    schedule();
    return true;
  };

  const cancelOwner = (owner: string, reason = 'owner cancelled'): void => {
    for (let index = queued.length - 1; index >= 0; index -= 1) {
      const item = queued[index]!;
      if (item.task.owner !== owner) continue;
      queued.splice(index, 1);
      counts.cancelled += 1;
      push(event(item.task, 'cancelled', reason));
    }
    for (const item of active.values()) {
      if (item.task.owner === owner) item.controller.abort(reason);
    }
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    for (const item of queued.splice(0)) {
      counts.cancelled += 1;
      push(event(item.task, 'cancelled', 'queue closed'));
    }
    for (const item of active.values()) item.controller.abort('queue closed');
  };

  const snapshot = (): BackgroundTaskSnapshot => ({
    queued: queued.length,
    active: active.size,
    completed: counts.completed,
    failed: counts.failed,
    cancelled: counts.cancelled,
    dropped: counts.dropped,
    rejected: counts.rejected,
    oldestQueuedAgeMs: oldestQueuedAge(),
    events: [...events],
  });

  const schedule = (): void => {
    startFor(
      ['user-visible', 'near-visible'],
      options.maxConcurrentUserVisible,
    );
    startFor(['maintenance', 'idle'], options.maxConcurrentMaintenance);
  };

  const startFor = (
    priorities: readonly BackgroundTaskPriority[],
    limit: number,
  ): void => {
    while (activeCount(priorities) < limit) {
      const index = queued.findIndex((item) =>
        priorities.includes(item.task.priority),
      );
      if (index < 0) return;
      start(queued.splice(index, 1)[0]!.task);
    }
  };

  const start = (task: BackgroundTask): void => {
    const controller = new AbortController();
    active.set(task.id, { task, controller });
    push(event(task, 'started'));
    void run(task, controller);
  };

  const run = async (
    task: BackgroundTask,
    controller: AbortController,
  ): Promise<void> => {
    try {
      await task.run({
        signal: controller.signal,
        checkpoint: () => backgroundYield(controller.signal),
        report: push,
      });
      throwIfAborted(controller.signal);
      counts.completed += 1;
      push(event(task, 'completed'));
    } catch (error) {
      if (controller.signal.aborted || isBackgroundTaskCancelled(error)) {
        counts.cancelled += 1;
        push(event(task, 'cancelled', 'aborted'));
      } else {
        counts.failed += 1;
        push(event(task, 'failed', errorReason(error)));
      }
    } finally {
      active.delete(task.id);
      schedule();
    }
  };

  const reject = (task: BackgroundTask, reason: string): false => {
    counts.rejected += 1;
    push(event(task, 'rejected', reason));
    return false;
  };

  const dropIdle = (incoming: BackgroundTask): boolean => {
    const index = queued.findIndex((item) => item.task.priority === 'idle');
    if (index < 0 || incoming.priority === 'idle') return false;
    const [dropped] = queued.splice(index, 1);
    if (!dropped) return false;
    counts.dropped += 1;
    push(event(dropped.task, 'dropped', 'queue full'));
    return true;
  };

  const push = (next: BackgroundTaskEvent): void => {
    events.push(next);
    if (events.length > options.maxEvents) events.splice(0, 1);
  };

  const event = (
    task: BackgroundTask,
    type: BackgroundTaskEvent['type'],
    reason?: string,
  ): BackgroundTaskEvent => ({
    type,
    taskId: task.id,
    owner: task.owner,
    priority: task.priority,
    at: options.now(),
    reason,
  });

  const activeCount = (priorities: readonly BackgroundTaskPriority[]): number =>
    [...active.values()].filter((item) =>
      priorities.includes(item.task.priority),
    ).length;

  const oldestQueuedAge = (): number => {
    const oldest = Math.min(...queued.map((item) => item.queuedAt));
    return Number.isFinite(oldest) ? options.now() - oldest : 0;
  };

  return { enqueue, cancelOwner, snapshot, close };
}

function emptyCounts(): MutableCounts {
  return { completed: 0, failed: 0, cancelled: 0, dropped: 0, rejected: 0 };
}
