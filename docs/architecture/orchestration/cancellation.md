# Cancellation

## Purpose

Cancellation defines how owners stop asynchronous work without retaining hidden
resources or applying late results to closed surfaces.

## Owner Rules

- Each tab, feed runtime, relay runtime, storage worker, and workspace has a
  stable owner id for task cancellation.
- Parent owners cancel child owners before releasing their own resources.
- Cleanup is idempotent.
- Cancellation aborts queued work and in-flight work.
- Late completions after abort are ignored and recorded as bounded diagnostics.

## Abort Rules

- Tasks receive an `AbortSignal` before they start.
- Long loops call `checkpoint()` between batches.
- `checkpoint()` throws or rejects when the signal is aborted.
- Every direct `AbortSignal` listener is removed in a `finally` block.
- Timer handles are cleared during owner cleanup.

## Storage Rules

- Storage compaction, repair, and inventory split work into batches.
- A cancelled storage task finishes the active SQLite statement safely, then
  stops before starting the next batch.
- Required write ordering is preserved even when low-priority tasks are
  cancelled.
- Stats reports cancellation as a concrete state, not success.

## Relay Rules

- Closing a feed runtime cancels page reads, live lease ownership, metadata
  hydration, and reference hydration.
- Limiter waiters are removed when their owner aborts.
- Late relay frames after close do not mutate closed runtime state.
- Filter mismatch evidence is scoped to request context and cannot permanently
  disable a relay.
