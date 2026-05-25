# Heap Retention

## Purpose

This document records the memory retention symptoms observed in the app and the
investigation strategy to fix them. The goal is to keep the browser JavaScript
heap bounded during normal use and prevent monotonic growth.

## Observed Symptoms

A Chrome DevTools heap snapshot taken after heavy feed usage showed a retained
heap approaching one gigabyte. The dominant retained object groups were:

- Millions of `Function` objects.
- Roughly ninety thousand `IDBRequest` and `IDBTransaction` objects.
- Hundreds of thousands of Svelte runtime context and scope objects.
- Hundreds of thousands of event listeners.
- Many `AbortSignal` instances.
- Many objects shaped like relay diagnostic summaries.

These numbers are a starting hypothesis, not final proof. The actual retaining
paths must be confirmed with heap snapshots before a fix can be declared
complete.

## Investigation Rules

- Use production builds for authoritative memory measurements. Dev-server
  memory is diagnostic only because it includes source maps, hot-module state,
  and extra instrumentation.
- Collect heap snapshots before and after a reproducible workload.
- Compare retained object counts after forced garbage collection.
- Trace retaining paths for each major object group.
- Write down the confirmed root cause, the owning source module, the cleanup
  function that should release the object, and the test that will fail before
  the fix and pass after it.
- Do not clear durable IndexedDB user data as a shortcut. Only prune bounded
  runtime caches and fallback stores.

## Budgets

These budgets are initial targets and may be refined after measurement:

- Clean startup after forced GC: under `160 MiB` used JavaScript heap.
- Heavy feed churn after forced GC: under `350 MiB` used JavaScript heap.
- Open and close fifty tabs after forced GC: less than `80 MiB` retained delta.
- After closing all test-created tabs and subscriptions: zero active paged reads,
  zero queued read waiters, zero publish waiters, zero active test relay
  subscriptions, zero active app-owned abort listeners for closed work, zero
  active workers for closed work.
- Relay pool debug client count returns to zero after idle eviction and pool
  close.

## Major Leak Areas

### IndexedDB and Dexie churn

Dexie `IDBRequest` and `IDBTransaction` objects can accumulate when operations
are not awaited to completion or when requests are created faster than they
settle. The fix is to batch reads and writes, use bounded cursor scans instead
of unbounded `toArray`, and ensure `try/finally` decrements operation counters.

### Relay diagnostic summaries

Relay diagnostic summary objects contain a `recentDiagnostics` array that grows
with each snapshot merge. Summaries are stored in IndexedDB on every update.
The fix is to keep only the most recent configured summaries in memory, cap the
`recentDiagnostics` array, batch persistence writes, and avoid one
transaction per tiny update.

### Abort listener accumulation

Every paged read or deduped read adds an abort listener. If the read settles
normally, the listener must be removed. If the signal never aborts, the
listener still retains the callback and its closure context. The fix is to
remove every listener in `finally` and use a shared helper.

### Svelte context, store, and listener retention

Svelte reactive statements, store subscriptions, and event listeners can retain
entire feed arrays or runtime handles through closures. The fix is to use
lifecycle cleanup, pass event IDs instead of raw events to rows, and avoid
storing large objects in context.

### Relay pool and subscription manager

Relay clients, subscription maps, publish waiters, idle timers, and reconnect
timers can survive after active work ends. The fix is deterministic cleanup:
send `CLOSE`, delete subscription state, resolve waiters exactly once, clear
timers, and evict idle clients from the pool map.

### Feed and profile caches

Profile summaries, token caches, and feed runtime windows can grow without
bounds. The fix is to use bounded LRU or TTL caches with documented caps.

## Cleanup Ownership

Every retained object group must have an explicit owner. See
[resource-ownership.md](resource-ownership.md) for the full table.

## Test Strategy

- Unit tests prove each factory releases its resources.
- Component tests prove destroy removes listeners and cancels async
  continuations.
- Playwright e2e tests run against a production build, force GC at checkpoints,
  and assert heap stays under the documented budget.
- Memory tests read compact runtime counters and assert they return to zero
  after teardown.

## Reference

- [bounded-memory.md](bounded-memory.md): general bounded memory rules.
- [memory-prioritization.md](memory-prioritization.md): durable versus runtime
  data priorities.
- [resource-ownership.md](resource-ownership.md): who creates and who closes
  each resource.
