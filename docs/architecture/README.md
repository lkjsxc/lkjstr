# Architecture

## Purpose

Architecture docs assign source ownership for app behavior. They define where
state lives, which modules own subscriptions, and how tabs close cleanly.

## Task Routing

- Shared browser services: [backend/README.md](backend/README.md).
- Feed source semantics and invariants: [feeds/README.md](feeds/README.md).
- Storage, cache, and memory ownership: [data/README.md](data/README.md).
- OPFS SQLite storage target: [data/sqlite-opfs/README.md](data/sqlite-opfs/README.md).
- Relay clients and orchestration: [network/README.md](network/README.md).
- Rust/WASM target ownership: [rust-wasm/README.md](rust-wasm/README.md).
- Tab lifecycle and pane behavior: [workspace/README.md](workspace/README.md).

## Table of Contents

- [backend/README.md](backend/README.md): browser-local backend services.
- [backend/boundary.md](backend/boundary.md): local backend boundary.
- [backend/cache-budget.md](backend/cache-budget.md): cache byte budget.
- [backend/home-query-lifecycle.md](backend/home-query-lifecycle.md):
  shared Home queries.
- [backend/query-registry.md](backend/query-registry.md): query ownership.
- [backend/transport-contract.md](backend/transport-contract.md):
  local transport.
- [rust-wasm/README.md](rust-wasm/README.md): Rust/WASM target ownership.
- [rust-wasm/app-boundary.md](rust-wasm/app-boundary.md): app composition.
- [rust-wasm/crate-boundaries.md](rust-wasm/crate-boundaries.md): crate map.
- [rust-wasm/cutover/README.md](rust-wasm/cutover/README.md): build cutover
  and deletion ledgers.
- [rust-wasm/cutover/build-contract.md](rust-wasm/cutover/build-contract.md):
  Rust/WASM app build contract.
- [rust-wasm/cutover/parity-ledger.md](rust-wasm/cutover/parity-ledger.md):
  product surface parity.
- [rust-wasm/cutover/deletion-ledger.md](rust-wasm/cutover/deletion-ledger.md):
  TypeScript and Svelte removal guard.
- [rust-wasm/host-boundary.md](rust-wasm/host-boundary.md): browser API boundary.
- [rust-wasm/memory-ownership.md](rust-wasm/memory-ownership.md): resource cleanup.
- [rust-wasm/protocol-kernel.md](rust-wasm/protocol-kernel.md): protocol owner.
- [rust-wasm/relay-runtime.md](rust-wasm/relay-runtime.md): relay owner.
- [rust-wasm/source-map.md](rust-wasm/source-map.md): target paths.
- [rust-wasm/status.md](rust-wasm/status.md): active migration status.
- [rust-wasm/storage-kernel.md](rust-wasm/storage-kernel.md): storage owner.
- [rust-wasm/ui-runtime.md](rust-wasm/ui-runtime.md): Leptos UI owner.
- [rust-wasm/verification.md](rust-wasm/verification.md): Rust/WASM checks.
- [feeds/README.md](feeds/README.md): feed sources, invariants, merge, cursors.
- [feeds/invariants/README.md](feeds/invariants/README.md): ordering, paging,
  filter safety.
- [feeds/invariants/event-ordering.md](feeds/invariants/event-ordering.md):
  canonical sort keys.
- [feeds/invariants/filter-safety.md](feeds/invariants/filter-safety.md):
  protocol-safe filters.
- [feeds/invariants/paging-cursors.md](feeds/invariants/paging-cursors.md):
  cursor fields and bounds.
- [feeds/sources/README.md](feeds/sources/README.md): Home, Global, Profile,
  Notifications filter semantics.
- [feeds/sources/home.md](feeds/sources/home.md): Home follow discovery.
- [feeds/sources/global.md](feeds/sources/global.md): Global firehose filters.
- [feeds/sources/notifications.md](feeds/sources/notifications.md):
  notification `#p` filters.
- [feeds/sources/profile.md](feeds/sources/profile.md): profile note filters.
- [feeds/runtime/README.md](feeds/runtime/README.md): merge reducer, cursors,
  multi-tab ownership.
- [feeds/runtime/feed-runtime-core.md](feeds/runtime/feed-runtime-core.md):
  Rust feed runtime core.
- [feeds/runtime/feed-surface-inputs.md](feeds/runtime/feed-surface-inputs.md):
  Rust Home and Global input builders.
- [feeds/runtime/feed-window-reducer.md](feeds/runtime/feed-window-reducer.md):
  Rust feed-window reducer.
- [feeds/runtime/merge-reducer.md](feeds/runtime/merge-reducer.md): merge-by-id.
- [feeds/runtime/multi-tab-ownership.md](feeds/runtime/multi-tab-ownership.md):
  per-tab runtime keys.
- [feeds/runtime/per-runtime-cursors.md](feeds/runtime/per-runtime-cursors.md):
  page cursors per tab.
- [feeds/runtime/relay-incomplete-windows.md](feeds/runtime/relay-incomplete-windows.md):
  incomplete relay windows.
- [feeds/orchestration-bridge.md](feeds/orchestration-bridge.md): planner bridge.
- [data/README.md](data/README.md): repository, cache, and event tree model.
- [data/bounded-memory.md](data/bounded-memory.md): bounded memory cleanup.
- [data/event-tree.md](data/event-tree.md): event row tree model.
- [data/event-surface-paging.md](data/event-surface-paging.md): shared feed
  paging and status rows.
- [data/feed-surface.md](data/feed-surface.md): feed list, prefetch, and staged
  rows.
- [data/feed-surface/README.md](data/feed-surface/README.md): feed surface
  index.
- [data/feed-surface/near-end.md](data/feed-surface/near-end.md): near-end
  prefetch.
- [data/feed-surface/older-load-mode.md](data/feed-surface/older-load-mode.md):
  older paging intent gating.
- [data/feed-surface/footer-phase.md](data/feed-surface/footer-phase.md): footer
  phase reducer.
- [data/feed-surface/staged-pipeline.md](data/feed-surface/staged-pipeline.md):
  staged row pipeline.
- [data/feed-surface/surface-matrix.md](data/feed-surface/surface-matrix.md):
  per-surface list matrix.
- [data/feed-surface/feed-scroll-surface.md](data/feed-surface/feed-scroll-surface.md):
  shared feed scroll shell.
- [data/feed-surface/feed-row-chrome.md](data/feed-surface/feed-row-chrome.md):
  list-owned row separators.
- [data/feed-surface/event-value.md](data/feed-surface/event-value.md):
  visible event value and retention.
- [data/cache-first-feed-pages.md](data/cache-first-feed-pages.md):
  cache-first proof for bounded grouped feed pages.
- [data/feed-memory.md](data/feed-memory.md): feed windows and scroll anchors.
- [data/feed-coverage.md](data/feed-coverage.md): durable feed range evidence
  and cache eligibility.
- [data/storage/README.md](data/storage/README.md): storage kernel entry point.
- [data/sqlite-opfs/README.md](data/sqlite-opfs/README.md): OPFS SQLite target.
- [data/sqlite-opfs/runtime.md](data/sqlite-opfs/runtime.md): worker runtime.
- [data/sqlite-opfs/storage-modes.md](data/sqlite-opfs/storage-modes.md):
  persistent and temporary modes.
- [data/sqlite-opfs/schema.md](data/sqlite-opfs/schema.md): SQLite schema.
- [data/sqlite-opfs/worker-protocol.md](data/sqlite-opfs/worker-protocol.md):
  worker protocol.
- [data/sqlite-opfs/query-ownership.md](data/sqlite-opfs/query-ownership.md):
  SQL-owned reads and memory-only state.
- [data/sqlite-opfs/repositories.md](data/sqlite-opfs/repositories.md):
  repository boundary.
- [data/sqlite-opfs/migration-map.md](data/sqlite-opfs/migration-map.md):
  current storage family to SQLite table map.
- [data/sqlite-opfs/retention.md](data/sqlite-opfs/retention.md): retention.
- [data/sqlite-opfs/failure-recovery.md](data/sqlite-opfs/failure-recovery.md):
  startup and reset recovery.
- [data/sqlite-opfs/import-export.md](data/sqlite-opfs/import-export.md):
  import and export.
- [data/storage/kernel/README.md](data/storage/kernel/README.md): manifest,
  operations, transactions, and repositories.
- [data/storage/kernel/manifest.md](data/storage/kernel/manifest.md): manifest
  fields and consumers.
- [data/storage/kernel/schema-steps.md](data/storage/kernel/schema-steps.md):
  Dexie schema step rules.
- [data/storage/kernel/operation-results.md](data/storage/kernel/operation-results.md):
  typed storage outcomes.
- [data/storage/kernel/transactions.md](data/storage/kernel/transactions.md):
  write transaction families.
- [data/storage/kernel/repositories.md](data/storage/kernel/repositories.md):
  repository boundary.
- [data/storage/kernel/failure-recovery.md](data/storage/kernel/failure-recovery.md):
  degraded startup recovery.
- [data/storage/kernel/local-secrets.md](data/storage/kernel/local-secrets.md):
  signing secret boundary.
- [data/storage/data-classes/README.md](data/storage/data-classes/README.md):
  durable data classes.
- [data/storage/data-classes/ownership-classes.md](data/storage/data-classes/ownership-classes.md):
  ownership classes.
- [data/storage/data-classes/table-manifest.md](data/storage/data-classes/table-manifest.md):
  live table matrix.
- [data/storage/data-classes/feed-coverage-correctness.md](data/storage/data-classes/feed-coverage-correctness.md):
  coverage proof validity.
- [data/storage/data-classes/tab-snapshots.md](data/storage/data-classes/tab-snapshots.md):
  tab-state persistence.
- [data/storage/retention/README.md](data/storage/retention/README.md):
  storage retention.
- [data/storage/retention/ledger.md](data/storage/retention/ledger.md):
  shared cache ledger.
- [data/storage/retention/byte-accounting.md](data/storage/retention/byte-accounting.md):
  deterministic byte estimates.
- [data/storage/retention/scoring.md](data/storage/retention/scoring.md):
  retention scoring.
- [data/storage/retention/dynamic-protection.md](data/storage/retention/dynamic-protection.md):
  runtime protection.
- [data/storage/retention/deletion.md](data/storage/retention/deletion.md):
  delete dispatchers.
- [data/storage/retention/repair.md](data/storage/retention/repair.md):
  ledger repair.
- [data/storage/diagnostics/README.md](data/storage/diagnostics/README.md):
  storage diagnostics.
- [data/storage/diagnostics/inventory.md](data/storage/diagnostics/inventory.md):
  storage inventory.
- [data/storage/diagnostics/pressure-states.md](data/storage/diagnostics/pressure-states.md):
  pressure states.
- [data/storage/diagnostics/stats.md](data/storage/diagnostics/stats.md):
  Stats projection.
- [data/storage/diagnostics/verification.md](data/storage/diagnostics/verification.md):
  storage verification.
- [data/heap-retention.md](data/heap-retention.md): observed symptoms and
  investigation strategy.
- [data/local-secret-security.md](data/local-secret-security.md):
  passkey-protected local secret storage.
- [data/memory-prioritization.md](data/memory-prioritization.md): durable data
  and runtime retention priority.
- [data/relay-pages.md](data/relay-pages.md): relay page ordering and
  provenance.
- [data/resource-ownership.md](data/resource-ownership.md): who creates and
  who closes each resource.
- [network/README.md](network/README.md): relay, identity, jobs, and settings.
- [network/identity-rendering.md](network/identity-rendering.md): identity
  hydration.
- [network/job-manager.md](network/job-manager.md): background jobs.
- [network/relay-pool.md](network/relay-pool.md): WebSocket relay clients.
- [network/progressive-relay-rendering.md](network/progressive-relay-rendering.md):
  progressive relay rendering.
- [network/relay-routing.md](network/relay-routing.md): protocol-derived read
  routing.
- [network/request-budget/README.md](network/request-budget/README.md):
  request budgets and relay metadata.
- [network/request-budget/effective-limits.md](network/request-budget/effective-limits.md):
  limit derivation.
- [network/request-budget/intent.md](network/request-budget/intent.md):
  budget intent fields.
- [network/request-budget/message-size.md](network/request-budget/message-size.md):
  outbound request bytes.
- [network/request-budget/nip11.md](network/request-budget/nip11.md):
  relay information budget data.
- [network/request-budget/scoring.md](network/request-budget/scoring.md):
  score boundary.
- [network/request-budget/source-map.md](network/request-budget/source-map.md):
  code map.
- [network/request-budget/tests.md](network/request-budget/tests.md):
  verification gates.
- [network/settings-store.md](network/settings-store.md): settings storage.
- [network/subscription-manager.md](network/subscription-manager.md): shared
  relay reads.
- [network/subscription-orchestration/README.md](network/subscription-orchestration/README.md):
  Demand and Lease orchestration index.
- [network/subscription-orchestration/demand-intent.md](network/subscription-orchestration/demand-intent.md):
  intent shapes and owner keys.
- [network/subscription-orchestration/feed-route-isolation.md](network/subscription-orchestration/feed-route-isolation.md):
  route fingerprints and cross-surface isolation.
- [network/subscription-orchestration/home-integration.md](network/subscription-orchestration/home-integration.md):
  Home bootstrap, live, and paging.
- [network/subscription-orchestration/ingress.md](network/subscription-orchestration/ingress.md):
  live event classification.
- [network/subscription-orchestration/lease-key.md](network/subscription-orchestration/lease-key.md):
  wire-equivalent fingerprints.
- [network/subscription-orchestration/live-lease.md](network/subscription-orchestration/live-lease.md):
  lease refcount and visibility.
- [network/subscription-orchestration/metrics.md](network/subscription-orchestration/metrics.md):
  orchestration counters.
- `network/subscription-orchestration/notifications-profile-thread-integration.md`:
  other feed surfaces.
- [network/subscription-orchestration/owner-visibility.md](network/subscription-orchestration/owner-visibility.md):
  hidden tab behavior.
- [network/subscription-orchestration/page-read-dedupe.md](network/subscription-orchestration/page-read-dedupe.md):
  semantic page keys.
- [network/subscription-orchestration/relay-read-scoring.md](network/subscription-orchestration/relay-read-scoring.md):
  relay plus request-context scheduling scores.
- [network/subscription-orchestration/route-plan.md](network/subscription-orchestration/route-plan.md):
  route planning.
- [network/subscription-orchestration/tests.md](network/subscription-orchestration/tests.md):
  verification gates.
- [network/subscription-orchestration/compatibility.md](network/subscription-orchestration/compatibility.md):
  Demand merge rules.
- [network/subscription-orchestration/routing-by-surface.md](network/subscription-orchestration/routing-by-surface.md):
  per-surface relay routes.
- [network/subscription-orchestration/source-map.md](network/subscription-orchestration/source-map.md):
  implementation modules.
- [network/system.md](network/system.md): app boundaries.
- [runtimes/README.md](runtimes/README.md): tab runtime data loading.
- [runtimes/global-runtime.md](runtimes/global-runtime.md): Global loading.
- [runtimes/home-runtime.md](runtimes/home-runtime.md): Home loading.
- [runtimes/notifications-runtime.md](runtimes/notifications-runtime.md):
  Notifications loading.
- [runtimes/profile-runtime.md](runtimes/profile-runtime.md): Profile loading.
- [runtimes/query-runtime.md](runtimes/query-runtime.md): query contracts.
- [runtimes/thread-runtime.md](runtimes/thread-runtime.md): Thread loading.
- [runtimes/tweet-runtime.md](runtimes/tweet-runtime.md): Tweet publishing.
- [workspace/README.md](workspace/README.md): layout, tabs, and visual shell.
- [workspace/pane-chrome-scope.md](workspace/pane-chrome-scope.md): header chrome
  vs body rects for drag hit testing.
- [workspace/pane-drop-target.md](workspace/pane-drop-target.md): pane-body
  drop resolver.
- [workspace/tab-body-mount.md](workspace/tab-body-mount.md): hidden-mount tab
  bodies per pane.
- [workspace/tab-retention-flow.md](workspace/tab-retention-flow.md):
  blur/focus snapshot pipeline.
- [workspace/tab-snapshot-fields.md](workspace/tab-snapshot-fields.md):
  compact tab snapshot payloads.
- [workspace/scroll-layout.md](workspace/scroll-layout.md): scrollbar-safe
  scrolling surfaces.
- [workspace/scroll-surface-audit.md](workspace/scroll-surface-audit.md):
  per-surface scroll checklist.
- [workspace/tab-shell-layout.md](workspace/tab-shell-layout.md): feed-tab vs
  form-tab scroll ownership.
- [workspace/resize.md](workspace/resize.md): resizing.
- [workspace/tile-overlays.md](workspace/tile-overlays.md): tile-scoped
  overlays.
- [workspace/tab-dragging.md](workspace/tab-dragging.md): tab drag zones and
  feedback.
- [workspace/tab-strip-gestures.md](workspace/tab-strip-gestures.md): tab rail
  gestures.
- [workspace/tab-runtime.md](workspace/tab-runtime.md): tab lifecycle.
- [workspace/theme.md](workspace/theme.md): theme.
- [workspace/tile-menu.md](workspace/tile-menu.md): tile menus.
- [workspace/ui-composition.md](workspace/ui-composition.md): UI ownership.
- [workspace/workspace-layout-tree.md](workspace/workspace-layout-tree.md):
  layout tree.

## Shared Contract

Browser runtimes normalize persisted fields before UI use. Relay diagnostics are
session state, separate from feed rows. Clean-browser Playwright output remains
authoritative for app-origin browser diagnostics.
