# Architecture

## Purpose

Architecture docs assign source ownership for browser-local runtime behavior,
state, storage, relay orchestration, cleanup, and Rust/WASM migration.

## Table of Contents

- [backend/README.md](backend/README.md): browser-local backend services.
- [data/README.md](data/README.md): cache, storage, event rows, and memory.
- [feeds/README.md](feeds/README.md): feed invariants, sources, and runtime.
- [network/README.md](network/README.md): relays, routing, jobs, and budgets.
- [orchestration/README.md](orchestration/README.md): database-backed decision memory.
- [runtime-ownership.md](runtime-ownership.md): owner map for shipped and target runtimes.
- [source-map.md](source-map.md): repository path ownership map.
- [rust-wasm/README.md](rust-wasm/README.md): Rust/WASM client target.
- [runtimes/README.md](runtimes/README.md): tab-owned data loading.
- [workspace/README.md](workspace/README.md): panes, tabs, scroll, and layout.

## High-Value Contracts

- [data/feed-surface/README.md](data/feed-surface/README.md): shared feed list contracts.
- [data/sqlite-opfs/README.md](data/sqlite-opfs/README.md): worker-owned SQLite OPFS path.
- [data/storage/README.md](data/storage/README.md): storage kernel and retention.
- [network/relay-optimizer/README.md](network/relay-optimizer/README.md): optimizer contracts.
- [network/request-budget/README.md](network/request-budget/README.md): effective relay limits.
- [network/subscription-orchestration/README.md](network/subscription-orchestration/README.md): Demand and Lease planning.
- [rust-wasm/cutover/README.md](rust-wasm/cutover/README.md): parity and deletion ledgers.

## All Files

```text
`README.md` `backend/README.md` `backend/boundary.md`
`backend/cache-budget.md` `backend/home-query-lifecycle.md` `backend/query-registry.md`
`backend/transport-contract.md` `data/README.md` `data/bounded-memory.md`
`data/cache-first-feed-pages.md` `data/event-surface-paging.md` `data/event-tree.md`
`data/feed-coverage.md` `data/feed-memory.md` `data/feed-surface.md`
`data/feed-surface/README.md` `data/feed-surface/event-value.md` `data/feed-surface/feed-row-chrome.md`
`data/feed-surface/feed-scroll-surface.md` `data/feed-surface/footer-phase.md` `data/feed-surface/height-reservation.md`
`data/feed-surface/lod-tree.md` `data/feed-surface/near-end.md` `data/feed-surface/older-load-mode.md`
`data/feed-surface/staged-pipeline.md` `data/feed-surface/surface-matrix.md` `data/heap-retention.md`
`data/local-secret-security.md` `data/memory-prioritization.md` `data/relay-pages.md`
`data/resource-ownership.md` `data/sqlite-opfs/README.md` `data/sqlite-opfs/failure-recovery.md`
`data/sqlite-opfs/import-export.md` `data/sqlite-opfs/migration-map.md` `data/sqlite-opfs/query-ownership.md`
`data/sqlite-opfs/repositories.md` `data/sqlite-opfs/retention.md` `data/sqlite-opfs/runtime.md`
`data/sqlite-opfs/schema.md` `data/sqlite-opfs/storage-modes.md` `data/sqlite-opfs/worker-protocol.md`
`data/storage/README.md` `data/storage/data-classes/README.md` `data/storage/data-classes/feed-coverage-correctness.md`
`data/storage/data-classes/ownership-classes.md` `data/storage/data-classes/tab-snapshots.md` `data/storage/data-classes/table-manifest.md`
`data/storage/diagnostics/README.md` `data/storage/diagnostics/inventory.md` `data/storage/diagnostics/pressure-states.md`
`data/storage/diagnostics/stats.md` `data/storage/diagnostics/verification.md` `data/storage/kernel/README.md`
`data/storage/kernel/failure-recovery.md` `data/storage/kernel/local-secrets.md` `data/storage/kernel/manifest.md`
`data/storage/kernel/operation-results.md` `data/storage/kernel/repositories.md` `data/storage/kernel/schema-steps.md`
`data/storage/kernel/transactions.md` `data/storage/retention/README.md` `data/storage/retention/byte-accounting.md`
`data/storage/retention/deletion.md` `data/storage/retention/dynamic-protection.md` `data/storage/retention/ledger.md`
`data/storage/retention/repair.md` `data/storage/retention/scoring.md` `feeds/README.md`
`feeds/invariants/README.md` `feeds/invariants/event-ordering.md` `feeds/invariants/filter-safety.md`
`feeds/invariants/paging-cursors.md` `feeds/orchestration-bridge.md` `feeds/runtime/README.md`
`feeds/runtime/feed-runtime-core.md` `feeds/runtime/feed-surface-inputs.md` `feeds/runtime/feed-window-reducer.md`
`feeds/runtime/merge-reducer.md` `feeds/runtime/multi-tab-ownership.md` `feeds/runtime/per-runtime-cursors.md`
`feeds/runtime/relay-incomplete-windows.md` `feeds/sources/README.md` `feeds/sources/global.md`
`feeds/sources/home.md` `feeds/sources/notifications.md` `feeds/sources/profile.md`
`feeds/sources/public-chat.md` `network/README.md` `network/identity-rendering.md`
`network/job-manager.md` `network/progressive-relay-rendering.md` `network/relay-optimizer/README.md`
`network/relay-optimizer/failure-states.md` `network/relay-optimizer/implementation-slices.md` `network/relay-optimizer/measurement-ledger.md`
`network/relay-optimizer/product-wiring-ledger.md` `network/relay-optimizer/relay-read-scoring.md` `network/relay-optimizer/relay-wait-policy.md`
`network/relay-optimizer/route-evidence-trust.md` `network/relay-optimizer/scan-width-adaptation.md` `network/relay-optimizer/source-map.md`
`network/relay-optimizer/stats-projection.md` `network/relay-optimizer/verification.md` `network/relay-pool.md`
`network/relay-routing.md` `network/request-budget/README.md` `network/request-budget/effective-limits.md`
`network/request-budget/intent.md` `network/request-budget/message-size.md` `network/request-budget/nip11.md`
`network/request-budget/scoring.md` `network/request-budget/source-map.md` `network/request-budget/tests.md`
`network/settings-store.md` `network/subscription-manager.md` `network/subscription-orchestration/README.md`
`network/subscription-orchestration/compatibility.md` `network/subscription-orchestration/demand-intent.md` `network/subscription-orchestration/feed-route-isolation.md`
`network/subscription-orchestration/home-integration.md` `network/subscription-orchestration/ingress.md` `network/subscription-orchestration/lease-key.md`
`network/subscription-orchestration/live-lease.md` `network/subscription-orchestration/metrics.md` `network/subscription-orchestration/notifications-profile-thread-integration.md`
`network/subscription-orchestration/owner-visibility.md` `network/subscription-orchestration/page-read-dedupe.md` `network/subscription-orchestration/relay-read-scoring.md`
`network/subscription-orchestration/route-plan.md` `network/subscription-orchestration/routing-by-surface.md` `network/subscription-orchestration/source-map.md`
`network/subscription-orchestration/tests.md` `network/system.md` `orchestration/README.md`
`orchestration/background-work.md` `orchestration/cancellation.md` `orchestration/database-memory.md`
`orchestration/decision-model.md` `orchestration/stats.md` `orchestration/surface-inputs.md`
`orchestration/task-queue.md` `orchestration/verification.md` `runtime-ownership.md`
`runtimes/README.md` `runtimes/followees-runtime.md` `runtimes/global-runtime.md`
`runtimes/home-runtime.md` `runtimes/notifications-runtime.md` `runtimes/profile-runtime.md`
`runtimes/public-chat-runtime.md` `runtimes/query-runtime.md` `runtimes/thread-runtime.md`
`runtimes/tweet-runtime.md` `runtimes/user-timeline-runtime.md` `rust-wasm/README.md`
`rust-wasm/app-boundary.md` `rust-wasm/crate-boundaries.md` `rust-wasm/cutover/README.md`
`rust-wasm/cutover/build-contract.md` `rust-wasm/cutover/deletion-ledger.md` `rust-wasm/cutover/parity-ledger.md`
`rust-wasm/host-boundary.md` `rust-wasm/memory-ownership.md` `rust-wasm/protocol-kernel.md`
`rust-wasm/relay-runtime.md` `rust-wasm/source-map.md` `rust-wasm/status.md`
`rust-wasm/storage-kernel.md` `rust-wasm/ui-runtime.md` `rust-wasm/verification.md`
`source-map.md` `workspace/README.md` `workspace/pane-chrome-scope.md`
`workspace/pane-drop-target.md` `workspace/resize.md` `workspace/scroll-layout.md`
`workspace/scroll-surface-audit.md` `workspace/tab-body-mount.md` `workspace/tab-dragging.md`
`workspace/tab-retention-flow.md` `workspace/tab-runtime.md` `workspace/tab-shell-layout.md`
`workspace/tab-snapshot-fields.md` `workspace/tab-strip-gestures.md` `workspace/theme.md`
`workspace/tile-menu.md` `workspace/tile-overlays.md` `workspace/ui-composition.md`
`workspace/workspace-layout-tree.md`
```

## Shared Contract

- Browser runtimes normalize persisted rows before UI use.
- Durable optimizer rows are recoverable performance and diagnostic data.
- Correctness remains with selected-relay fallback, disabled-relay exclusion,
  and interval-union coverage proof.
- Relay diagnostics are separate from feed rows.
- Manual clean-browser diagnostics output remains authoritative for app-origin browser
  diagnostics.
