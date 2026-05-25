# Memory Verification

## Purpose

This document defines how to run memory tests, collect heap snapshots, and
interpret the results. Memory verification is a required gate before claiming
that a release or change is safe.

## Commands

Run the focused memory e2e test:

```sh
pnpm test:e2e:memory
```

Run the full e2e suite including memory tests:

```sh
pnpm test:e2e
```

Run the Docker Compose e2e path:

```sh
docker compose -f docker-compose.yml run --rm e2e
```

## Heap Snapshot Collection

1. Build the production app:
   ```sh
   pnpm build
   ```
2. Start the preview server:
   ```sh
   pnpm preview
   ```
3. Open Chromium and navigate to the app.
4. Open DevTools, go to the Memory tab.
5. Click the garbage can icon to force GC.
6. Take a heap snapshot.
7. Perform the workload (open tabs, load feeds, close tabs).
8. Force GC again.
9. Take a second heap snapshot.
10. Compare retained object counts between the two snapshots.

## Authoritative Measurements

The following measurements are owned assertions. A test failure means the
change cannot land:

- **Used JavaScript heap after forced GC**: Measured via
  `performance.memory.usedJSHeapSize` in Chromium or CDP `Runtime.getHeapUsage`.
- **Compact runtime counter cleanup**: After closing all test-created tabs and
  subscriptions, every app-owned counter must read zero.
- **Heap delta after repeated open/close cycles**: The delta must stay under the
  documented threshold.

## Diagnostic Measurements

The following measurements help investigation but do not block a change by
itself:

- **RSS**: System resident set size includes the browser process, renderer,
  GPU, and other sub-processes. It is noisy and not a precise signal for
  JavaScript heap leaks.
- **DevTools live heap size**: Includes retained and non-retained objects
  before forced GC.
- **Synthetic relay fixture memory**: The test relay itself has overhead that
  is not app-owned.

## Interpreting a Retained Object Spike

1. Force GC and take a heap snapshot.
2. Search for the suspect object type (for example `IDBRequest`,
   `RelayDiagnosticSummary`, `AbortSignal`).
3. Note the constructor or object shape and approximate retained count.
4. Follow the retaining path to find the owning module.
5. Identify the cleanup function that should have released it.
6. Write a test that fails before the fix and passes after it.
7. Apply the fix and re-run the memory test.

## Test Artifacts

- Heap snapshots are large binary files. Do not commit them to the repository.
- Store snapshots in `/tmp/` or a local `artifacts/` directory that is
  `.gitignore`d.
- Commit only the counter JSON and a short diagnostic note.

## Budgets

See [heap-retention.md](../architecture/data/heap-retention.md) for the current
budgets and targets.

## Regression Tests

The e2e memory test must:

- Launch Chromium with forced GC support or use CDP heap collection.
- Start the app at `/`.
- Use deterministic relay-like input.
- Open and close Home, Global, Profile, Notifications, Custom Request, Search,
  and Thread surfaces.
- Simulate relay churn, profile hydration, event reference previews, tab
  creation, tab closing, and pane splitting.
- Force GC at stable checkpoints.
- Read compact counters.
- Fail if heap growth is unbounded.
- Fail if cleanup counters remain nonzero after teardown.

## Reference

- [heap-retention.md](../architecture/data/heap-retention.md): symptoms,
  investigation strategy, and budgets.
- [resource-ownership.md](../architecture/data/resource-ownership.md): who
  creates and who closes each resource.
- [verification.md](verification.md): general verification commands.
