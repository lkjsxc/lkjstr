# Network And Runtimes

## Purpose

Relay, orchestration, and runtime ownership state.

## Details

Read next: [architecture/network/README.md](../architecture/network/README.md),
[architecture/runtimes/README.md](../architecture/runtimes/README.md), and [architecture/orchestration/README.md](../architecture/orchestration/README.md).

- Surfaces submit demands. The subscription orchestrator plans shared leases
  and issues reads through the subscription manager.
- Feed route isolation keeps Home and Profile route-group reads on resolved
  route fingerprints, while Notifications and selected-relay tools keep
  independent semantic keys.
- Followees and User Timeline discover missing target kind `3` through selected
  relays and stored author routes while excluding disabled route relays. No-event/AUTH/rate-limited/timeout reads and partial route failures render diagnostics.
  Rust keeps distinct query surfaces, real rows, exact cached coverage, target-only degraded rows, incomplete detail, and partial status.
- Shipped Search mounts Rust as a WASM island with query snapshot restore/save,
  local indexed rows, bounded NIP-50 filters, cached/relay older pages,
  unsupported/clamped relay diagnostics, and a product guard against the
  retained TypeScript query runner.
- Shipped Custom Request mounts Rust as a WASM island with request/run-state
  snapshots, selected-relay reads, cancellation, app-owned rows, one scroll
  owner, relay output, effective-filter proof, and guarded no-import product proof; deletion remains open.
  Rust lkjstr Log wraps durable-row actions, status, and table rows in one
  scroll owner.
- Matching Home tabs share one query keyed by account, relays, page size, and policy.
- Background work is owner-scoped, cancellable, chunked, and non-blocking.
  Storage compaction, repair, inventory, optimizer, hydration, relay metadata,
  app-log trimming, and LOD work run through queued tasks.
- Stats, `__lkjstrMemoryDebug()`, and `window.__lkjstrDebug` expose
  orchestration demand, lease, event intake, storage operation, scan optimizer,
  storage pressure, feed geometry reservation, anchor compensation, memory
  counters, and Rust-owned User Timeline diagnostic aggregates when available.
- Relay publish waiters, paged read leases, deduped read abort listeners, relay
  final-close state, idle pool eviction, and background tasks have cleanup
  tests.
- Runtime counters use static aggregate keys only.
