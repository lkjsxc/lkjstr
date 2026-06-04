# Memory Verification

## Purpose

Memory verification proves app-owned resources are bounded, cleaned up, and
observable. Automated gates use focused tests and runtime counters. Browser heap
and RSS measurements are manual diagnostics.

## Automated Gate

```sh
pnpm check:repo
pnpm test -- tests/unit/fp tests/unit/memory tests/unit/app/runtime-counters.test.ts
pnpm test -- tests/unit/relays/subscription-manager-read-limiter.test.ts
pnpm test -- tests/unit/relays/subscription-manager-dedupe.test.ts
pnpm test -- tests/unit/timeline/timeline-runtime-close.test.ts
pnpm test -- tests/unit/cache tests/unit/feed-surface
pnpm test:quiet
```

The gate proves:

- factory cleanup is idempotent;
- abort listeners are removed in `finally` paths;
- timers are cleared on owner teardown;
- request maps, wait queues, diagnostic arrays, feed windows, and retention
  stores have deletion paths or explicit bounds;
- queued relay reads abort when owners close;
- hidden feed tabs release live demands;
- storage operations settle and decrement counters;
- background tasks cancel by owner and cannot grow unbounded;
- cache compaction and repair run in bounded batches.

## Runtime Counters

`__lkjstrMemoryDebug()` and `window.__lkjstrDebug` expose aggregate counters for
live demands, leases, read waiters, publish waiters, relay clients, storage
operations, background tasks, and bounded diagnostic collections.

Counters use static aggregate keys only. They must not include tab ids, event
ids, relay URLs, request ids, or user-controlled strings as metric names.

## Background Work Rules

Long work must run through cancellable owners:

- storage physical inventory;
- cache compaction and repair;
- optimizer trace and density reductions;
- profile and reference hydration;
- relay metadata refresh;
- app-log trimming;
- LOD degradation and rehydration planning.

Each task has an owner, abort signal, bounded queue policy, checkpoint, and
error reporting path. Maintenance work yields often and never blocks visible UI.

## Manual Browser Diagnostics

Use manual browser diagnostics when investigating suspected runtime pressure:

1. Build the production app.
2. Start preview.
3. Open a clean profile.
4. Record app JavaScript heap when `performance.memory` exists.
5. Exercise the suspected long session with real or protocol-shaped synthetic
   relay data.
6. Record `__lkjstrMemoryDebug()` before and after closing tabs and relays.
7. Capture heap snapshots if counters do not explain growth.

Chromium RSS is diagnostic only because the browser process includes baseline,
renderer, GPU, cache, and tool overhead outside app ownership. App JavaScript
heap and app counters are the owned evidence.

## Acceptance

- Closing a workspace, tab, relay runtime, storage worker, or background owner
  returns owned counters to zero or to the documented bounded idle state.
- Hidden tabs do not continue feed paging or live relay work.
- Late relay, storage, or task completions after cancellation are ignored and
  do not retain owners.
- Manual heap observations that show growth get converted into focused tests
  for the owning reducer, repository, factory, or task queue.
