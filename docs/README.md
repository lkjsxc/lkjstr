# Docs

## Purpose

This tree is the implementation contract for lkjstr. Start with
[current-state.md](current-state.md), then follow the README in the area being
changed. Each docs directory has one README that acts as a table of contents.

## Table of Contents

- [current-state.md](current-state.md): concise implemented-state map.
- [product/README.md](product/README.md): user-visible behavior.
- [protocol/README.md](protocol/README.md): Nostr event and relay rules.
- [architecture/README.md](architecture/README.md): runtime and data ownership.
- [operations/README.md](operations/README.md): checks, Docker, and safety.
- [repository/README.md](repository/README.md): workflow and style rules.
- [security/README.md](security/README.md): local keys and content safety.
- [research/README.md](research/README.md): investigations.
- [vision/README.md](vision/README.md): product direction.
- [decisions/README.md](decisions/README.md): durable decisions.

## Fast Routing

- Feed behavior: [architecture/feeds/README.md](architecture/feeds/README.md),
  [architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md),
  and [architecture/orchestration/README.md](architecture/orchestration/README.md).
- Relay reads: [architecture/network/README.md](architecture/network/README.md)
  and [architecture/network/relay-optimizer/README.md](architecture/network/relay-optimizer/README.md).
- Storage: [architecture/data/sqlite-opfs/README.md](architecture/data/sqlite-opfs/README.md)
  and [architecture/data/storage/README.md](architecture/data/storage/README.md).
- Security: [security/README.md](security/README.md) and
  [architecture/data/local-secret-security.md](architecture/data/local-secret-security.md).
- Rust/WASM: [architecture/rust-wasm/README.md](architecture/rust-wasm/README.md).
- Verification: [operations/verification.md](operations/verification.md).

## All Files

```text
`README.md` `architecture/README.md` `architecture/backend/README.md`
`architecture/backend/boundary.md` `architecture/backend/cache-budget.md` `architecture/backend/home-query-lifecycle.md`
`architecture/backend/query-registry.md` `architecture/backend/transport-contract.md` `architecture/data/README.md`
`architecture/data/bounded-memory.md` `architecture/data/cache-first-feed-pages.md` `architecture/data/event-surface-paging.md`
`architecture/data/event-tree.md` `architecture/data/feed-coverage.md` `architecture/data/feed-memory.md`
`architecture/data/feed-surface.md` `architecture/data/feed-surface/README.md` `architecture/data/feed-surface/event-value.md`
`architecture/data/feed-surface/feed-row-chrome.md` `architecture/data/feed-surface/feed-scroll-surface.md` `architecture/data/feed-surface/footer-phase.md`
`architecture/data/feed-surface/height-reservation.md` `architecture/data/feed-surface/lod-tree.md` `architecture/data/feed-surface/near-end.md`
`architecture/data/feed-surface/older-load-mode.md` `architecture/data/feed-surface/staged-pipeline.md` `architecture/data/feed-surface/surface-matrix.md`
`architecture/data/heap-retention.md` `architecture/data/local-secret-security.md` `architecture/data/memory-prioritization.md`
`architecture/data/relay-pages.md` `architecture/data/resource-ownership.md` `architecture/data/sqlite-opfs/README.md`
`architecture/data/sqlite-opfs/failure-recovery.md` `architecture/data/sqlite-opfs/import-export.md` `architecture/data/sqlite-opfs/migration-map.md`
`architecture/data/sqlite-opfs/query-ownership.md` `architecture/data/sqlite-opfs/repositories.md` `architecture/data/sqlite-opfs/retention.md`
`architecture/data/sqlite-opfs/runtime.md` `architecture/data/sqlite-opfs/schema.md` `architecture/data/sqlite-opfs/storage-modes.md`
`architecture/data/sqlite-opfs/worker-protocol.md` `architecture/data/storage/README.md` `architecture/data/storage/data-classes/README.md`
`architecture/data/storage/data-classes/feed-coverage-correctness.md` `architecture/data/storage/data-classes/ownership-classes.md` `architecture/data/storage/data-classes/tab-snapshots.md`
`architecture/data/storage/data-classes/table-manifest.md` `architecture/data/storage/diagnostics/README.md` `architecture/data/storage/diagnostics/inventory.md`
`architecture/data/storage/diagnostics/pressure-states.md` `architecture/data/storage/diagnostics/stats.md` `architecture/data/storage/diagnostics/verification.md`
`architecture/data/storage/kernel/README.md` `architecture/data/storage/kernel/failure-recovery.md` `architecture/data/storage/kernel/local-secrets.md`
`architecture/data/storage/kernel/manifest.md` `architecture/data/storage/kernel/operation-results.md` `architecture/data/storage/kernel/repositories.md`
`architecture/data/storage/kernel/schema-steps.md` `architecture/data/storage/kernel/transactions.md` `architecture/data/storage/retention/README.md`
`architecture/data/storage/retention/byte-accounting.md` `architecture/data/storage/retention/deletion.md` `architecture/data/storage/retention/dynamic-protection.md`
`architecture/data/storage/retention/ledger.md` `architecture/data/storage/retention/repair.md` `architecture/data/storage/retention/scoring.md`
`architecture/feeds/README.md` `architecture/feeds/invariants/README.md` `architecture/feeds/invariants/event-ordering.md`
`architecture/feeds/invariants/filter-safety.md` `architecture/feeds/invariants/paging-cursors.md` `architecture/feeds/orchestration-bridge.md`
`architecture/feeds/runtime/README.md` `architecture/feeds/runtime/feed-runtime-core.md` `architecture/feeds/runtime/feed-surface-inputs.md`
`architecture/feeds/runtime/feed-window-reducer.md` `architecture/feeds/runtime/merge-reducer.md` `architecture/feeds/runtime/multi-tab-ownership.md`
`architecture/feeds/runtime/per-runtime-cursors.md` `architecture/feeds/runtime/relay-incomplete-windows.md` `architecture/feeds/sources/README.md`
`architecture/feeds/sources/global.md` `architecture/feeds/sources/home.md` `architecture/feeds/sources/notifications.md`
`architecture/feeds/sources/profile.md` `architecture/network/README.md` `architecture/network/identity-rendering.md`
`architecture/network/job-manager.md` `architecture/network/progressive-relay-rendering.md` `architecture/network/relay-optimizer/README.md`
`architecture/network/relay-optimizer/measurement-ledger.md` `architecture/network/relay-optimizer/product-wiring-ledger.md` `architecture/network/relay-optimizer/relay-read-scoring.md`
`architecture/network/relay-optimizer/relay-wait-policy.md` `architecture/network/relay-optimizer/route-evidence-trust.md` `architecture/network/relay-optimizer/scan-width-adaptation.md`
`architecture/network/relay-optimizer/stats-projection.md` `architecture/network/relay-optimizer/verification.md` `architecture/network/relay-pool.md`
`architecture/network/relay-routing.md` `architecture/network/request-budget/README.md` `architecture/network/request-budget/effective-limits.md`
`architecture/network/request-budget/intent.md` `architecture/network/request-budget/message-size.md` `architecture/network/request-budget/nip11.md`
`architecture/network/request-budget/scoring.md` `architecture/network/request-budget/source-map.md` `architecture/network/request-budget/tests.md`
`architecture/network/settings-store.md` `architecture/network/subscription-manager.md` `architecture/network/subscription-orchestration/README.md`
`architecture/network/subscription-orchestration/compatibility.md` `architecture/network/subscription-orchestration/demand-intent.md` `architecture/network/subscription-orchestration/feed-route-isolation.md`
`architecture/network/subscription-orchestration/home-integration.md` `architecture/network/subscription-orchestration/ingress.md` `architecture/network/subscription-orchestration/lease-key.md`
`architecture/network/subscription-orchestration/live-lease.md` `architecture/network/subscription-orchestration/metrics.md` `architecture/network/subscription-orchestration/notifications-profile-thread-integration.md`
`architecture/network/subscription-orchestration/owner-visibility.md` `architecture/network/subscription-orchestration/page-read-dedupe.md` `architecture/network/subscription-orchestration/relay-read-scoring.md`
`architecture/network/subscription-orchestration/route-plan.md` `architecture/network/subscription-orchestration/routing-by-surface.md` `architecture/network/subscription-orchestration/source-map.md`
`architecture/network/subscription-orchestration/tests.md` `architecture/network/system.md` `architecture/runtime-ownership.md`
`architecture/source-map.md` `architecture/orchestration/README.md`
`architecture/orchestration/background-work.md` `architecture/orchestration/cancellation.md` `architecture/orchestration/database-memory.md`
`architecture/orchestration/decision-model.md` `architecture/orchestration/stats.md` `architecture/orchestration/surface-inputs.md`
`architecture/orchestration/task-queue.md` `architecture/orchestration/verification.md` `architecture/runtimes/README.md`
`architecture/runtimes/global-runtime.md` `architecture/runtimes/home-runtime.md` `architecture/runtimes/notifications-runtime.md`
`architecture/runtimes/profile-runtime.md` `architecture/runtimes/query-runtime.md` `architecture/runtimes/thread-runtime.md`
`architecture/runtimes/tweet-runtime.md` `architecture/rust-wasm/README.md` `architecture/rust-wasm/app-boundary.md`
`architecture/rust-wasm/crate-boundaries.md` `architecture/rust-wasm/cutover/README.md` `architecture/rust-wasm/cutover/build-contract.md`
`architecture/rust-wasm/cutover/deletion-ledger.md` `architecture/rust-wasm/cutover/parity-ledger.md` `architecture/rust-wasm/host-boundary.md`
`architecture/rust-wasm/memory-ownership.md` `architecture/rust-wasm/protocol-kernel.md` `architecture/rust-wasm/relay-runtime.md`
`architecture/rust-wasm/source-map.md` `architecture/rust-wasm/status.md` `architecture/rust-wasm/storage-kernel.md`
`architecture/rust-wasm/ui-runtime.md` `architecture/rust-wasm/verification.md` `architecture/workspace/README.md`
`architecture/workspace/pane-chrome-scope.md` `architecture/workspace/pane-drop-target.md` `architecture/workspace/resize.md`
`architecture/workspace/scroll-layout.md` `architecture/workspace/scroll-surface-audit.md` `architecture/workspace/tab-body-mount.md`
`architecture/workspace/tab-dragging.md` `architecture/workspace/tab-retention-flow.md` `architecture/workspace/tab-runtime.md`
`architecture/workspace/tab-shell-layout.md` `architecture/workspace/tab-snapshot-fields.md` `architecture/workspace/tab-strip-gestures.md`
`architecture/workspace/theme.md` `architecture/workspace/tile-menu.md` `architecture/workspace/tile-overlays.md`
`architecture/workspace/ui-composition.md` `architecture/workspace/workspace-layout-tree.md` `current-state.md`
`decisions/README.md` `decisions/browser-first.md` `decisions/protocol-kernel.md`
`decisions/relay-ownership.md` `decisions/rust-wasm-client.md` `decisions/sqlite-opfs-storage.md`
`decisions/worker-owned-storage.md` `operations/README.md` `operations/ci.md`
`operations/cloudflare-workers.md` `operations/data-safety.md` `operations/diagnostics.md`
`operations/docker.md` `operations/feed-route-isolation-regression.md` `operations/focused-gates.md`
`operations/memory-verification.md` `operations/readiness.md` `operations/sqlite-opfs-testing.md`
`operations/storage-pressure-verification.md` `operations/testing-ownership.md` `operations/timeline-notification-regression-investigation.md`
`operations/verification.md` `product/README.md` `product/backlog.md`
`product/doc-impl-audit.md` `product/feeds/README.md` `product/feeds/global.md`
`product/feeds/home.md` `product/feeds/notifications.md` `product/feeds/profiles.md`
`product/feeds/threads.md` `product/tools/README.md` `product/tools/accounts.md`
`product/tools/author-context.md` `product/tools/cache.md` `product/tools/custom-request.md`
`product/tools/event-actions.md` `product/tools/log.md` `product/tools/mine-npub.md`
`product/tools/profile-edit.md` `product/tools/relay-management.md` `product/tools/search.md`
`product/tools/settings.md` `product/tools/stats.md` `product/tools/tweet.md`
`product/tools/upload-settings.md` `product/tools/welcome.md` `product/workspace/README.md`
`product/workspace/panes.md` `product/workspace/scope.md` `product/workspace/tabs.md`
`product/workspace/workflows.md` `product/workspace/workspace.md` `protocol/README.md`
`protocol/custom-emoji.md` `protocol/default-relays.md` `protocol/event-actions.md`
`protocol/events.md` `protocol/kernel.md` `protocol/media-upload.md`
`protocol/nip-support.md` `protocol/relays.md` `protocol/zaps.md`
`repository/README.md` `repository/commit-protocol.md` `repository/documentation-standards.md`
`repository/functional-style.md` `repository/layout.md` `repository/line-limits.md` `repository/llm-maintenance.md`
`repository/workflow.md` `security/README.md` `security/content-safety.md` `security/local-keys.md`
`research/README.md` `research/browser-storage.md`
`research/nostr-client-surfaces.md` `research/open-questions.md` `research/relay-optimizer-audit.md`
`vision/README.md` `vision/north-star.md` `vision/principles.md`
`vision/scope.md`

```

## Documentation Rules

- Keep docs aligned with implementation in the same change.
- Keep each Markdown file below 300 lines.
- Keep prose ASCII-only and avoid release shorthand words.
- Split large contracts into directories with a README and short child files.
- Do not document fake data paths as product behavior.
