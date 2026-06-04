# Task Queue

## Purpose

The task queue is the browser-local scheduler for background work. It is an
effectful runtime created by a factory function and closed by its owner.

## Shape

```ts
type BackgroundTaskPriority = 'user-visible' | 'near-visible' | 'maintenance' | 'idle';

type BackgroundTask = {
  readonly id: string;
  readonly owner: string;
  readonly priority: BackgroundTaskPriority;
  readonly run: (scope: BackgroundTaskScope) => Promise<void>;
};

type BackgroundTaskScope = {
  readonly signal: AbortSignal;
  readonly checkpoint: () => Promise<void>;
  readonly report: (event: BackgroundTaskEvent) => void;
};
```

The factory returns a plain handle with `enqueue`, `cancelOwner`, `snapshot`,
and `close` methods.

## Scheduling

- User-visible tasks run before near-visible tasks.
- Maintenance tasks run with a lower concurrency cap.
- Idle tasks may be dropped when the queue is full.
- Duplicate task ids replace or merge according to caller policy.
- Closed queues reject new work.
- Checkpoints yield with `requestIdleCallback` when available, then fall back to
  a timer-based yield.

## Bounds

The queue declares:

- maximum queued task count;
- maximum user-visible concurrency;
- maximum maintenance concurrency;
- maximum diagnostic event count;
- owner cancellation map cleanup path.

When the queue is full it records an explicit `dropped`, `replaced`, or
`rejected` event rather than growing unbounded.

## Diagnostics

Snapshots include active count, queued count, completed count, failed count,
cancelled count, dropped count, oldest queued age, and recent bounded events.
Task ids, owners, and error messages are data fields, not metric names.
