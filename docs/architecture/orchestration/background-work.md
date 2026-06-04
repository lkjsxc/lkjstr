# Background Work

## Purpose

Background work keeps visible UI responsive by moving long storage, relay,
optimizer, hydration, and retention operations behind cancellable tasks.

## Status

implemented for small cleanup and storage operations; design-only for full
product-wide adoption.

## Work Classes

Background tasks own:

- storage physical inventory;
- cache compaction and repair;
- cache ledger backfill;
- scan density reductions;
- relay optimizer trace persistence;
- profile metadata hydration;
- reference preview hydration;
- NIP-11 relay metadata refresh;
- NIP-65 suggestion discovery;
- app-log trimming;
- LOD degradation and rehydration planning;
- cache warming for uncovered feed intervals.

## Rules

- UI actions schedule work and receive immediate feedback.
- Every task has an owner string, abort signal, priority, and checkpoint.
- Every task has a deadline, batch limit, or yield point.
- Errors are recorded through bounded diagnostics and app log rows.
- No unhandled promises are allowed.
- The queue is bounded. It rejects, merges, replaces, or drops low-value tasks
  with a visible reason.
- Closing a tab, runtime, workspace, worker, or relay owner cancels its tasks.
- Maintenance tasks yield often and never block visible UI.
- Storage writes preserve serial ordering where required.

## Priorities

| Priority       | Meaning                                                      |
| -------------- | ------------------------------------------------------------ |
| `user-visible` | needed for the current visible surface                       |
| `near-visible` | likely needed soon for overscan or active navigation         |
| `maintenance`  | correctness, cleanup, repair, or diagnostics                 |
| `idle`         | opportunistic improvement that may be dropped under pressure |

## Acceptance

- Opening a tab does not synchronously scan storage.
- Stats starts with compact loading rows, then resolves or times out with exact
  unavailable state.
- Manual compact starts a task and returns immediate UI feedback.
- Closing a tab cancels feed reads, hydration tasks, and LOD materialization
  tasks owned by that tab.
- Relay reads abort queued limiter waiters when owners close.
