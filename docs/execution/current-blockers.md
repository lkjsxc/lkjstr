# Current Blockers

## Purpose

This file lists the current Rust/WASM blockers in dependency order. Status:
implemented as an execution map; each blocker points to the contract, crates,
shipped source paths, tests, and proof needed to move a cutover-ledger row.

## Dependency Order

Storage wiring enables relay proof. Relay wiring enables feed runtime proof.
Shared feed runtime proof enables surface cutover. Do not skip this order for
visible polish.

## 1. Storage command coverage

Complete remaining storage command coverage for retention, repair, full pressure
inventory diagnostics, and Rust Stats consumption.

Preserve implemented active selector, pressure, protected, event cache, feed
evidence, diagnostics, notifications, jobs, app log, inventory, optimizer,
retention, repair metadata and probes, and Search token, tag, and local-query
metadata.

- Cutover-ledger rows: [Protected tool storage](../architecture/rust-wasm/cutover/implementation-ledger.md)
  and [Event cache and feed evidence](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [storage README](../architecture/data/storage/README.md),
  [SQLite OPFS README](../architecture/data/sqlite-opfs/README.md),
  [repository contract](../architecture/data/sqlite-opfs/repositories.md),
  [storage kernel](../architecture/rust-wasm/storage-kernel.md), and
  [storage wiring](../architecture/rust-wasm/cutover/storage-wiring.md).
- Crates: `lkjstr-storage`, `lkjstr-web`, `lkjstr-app`, and `lkjstr-ui`.
- Shipped source paths: `crates/lkjstr-storage/`,
  `crates/lkjstr-web/src/sqlite_store/`, `src/lib/storage/sqlite-opfs/`,
  `src/lib/storage/repositories/`, `tests/unit/cache/`,
  `tests/unit/events/repository.test.ts`, and
  `tests/unit/feed-surface/scan-model-repository.test.ts`.
- Focused tests: `cargo test -p lkjstr-storage`,
  `cargo test -p lkjstr-web`,
  `pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts`,
  `pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts`, and
  `pnpm rust-wasm:quiet`.
- Completion proof: batch-capable Rust command specs cover implemented
  families, retention delete dispatch, repair metadata and probes, Search
  token, tag, and local-query metadata, current pressure byte projections,
  pressure-state mapping tests, UI Stats unavailable-state tests, storage-owned
  inventory readiness classification, and readiness-gated retention/repair app
  planning.
- Next proof: expand Rust storage product consumers toward Search app planning,
  NIP-50 merge, and feed/runtime use. Protected rows are never pruned; ledgers
  stay partial unless no-import proof exists.

## 2. Relay effect runner

Wire Rust relay effects to browser WebSocket, timers, NIP-11 fetch, budgets,
page-read cleanup, and progressive snapshots.

- Cutover-ledger row: [Relay runtime](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [network README](../architecture/network/README.md),
  [relay runtime](../architecture/rust-wasm/relay-runtime.md),
  [relay pool](../architecture/network/relay-pool.md),
  [relay routing](../architecture/network/relay-routing.md),
  [request budget](../architecture/network/request-budget/README.md), and
  [subscription orchestration](../architecture/network/subscription-orchestration/README.md).
- Crates: `lkjstr-relays`, `lkjstr-web`, and `lkjstr-app`.
- Shipped source paths: `crates/lkjstr-relays/`,
  `crates/lkjstr-web/src/relay*`, `src/lib/relays/`,
  `tests/unit/relays/`, `tests/unit/events/relay-page-scan.test.ts`, and
  `tests/unit/events/relay-page-adaptive-window.test.ts`.
- Focused tests: `cargo test -p lkjstr-relays`,
  `cargo test -p lkjstr-web`,
  `pnpm test -- tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-adaptive-window.test.ts`,
  and `pnpm rust-wasm:quiet`.
- Completion proof: Rust owns budgets, leases, malformed ingress diagnostics,
  owner-scoped cleanup, and progressive snapshots. Disabled relays stay
  excluded and partial failure remains diagnostic.

## 3. Shared feed runtime

Build shared feed runtime from strict cache proof, relay snapshots, row view
models, anchors, footer states, and unavailable states.

- Cutover-ledger row: [Shared feed runtime](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [feeds README](../architecture/feeds/README.md),
  [feed runtime](../architecture/feeds/runtime/README.md),
  [feed surface](../architecture/data/feed-surface/README.md),
  [cache-first pages](../architecture/data/cache-first-feed-pages.md),
  [feed coverage](../architecture/data/feed-coverage.md), and
  [event surface paging](../architecture/data/event-surface-paging.md).
- Crates: `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, `lkjstr-ui`, and
  `lkjstr-web`.
- Shipped source paths: `crates/lkjstr-app/src/feed/`,
  `crates/lkjstr-storage/`, `crates/lkjstr-relays/`, `crates/lkjstr-ui/`,
  `src/lib/feed-surface/`, `src/lib/timeline/`, `src/lib/profile/`,
  `src/lib/thread/`, and `src/lib/notifications/`.
- Focused tests: `cargo test -p lkjstr-app -- feed`,
  `cargo test -p lkjstr-storage`, `cargo test -p lkjstr-relays`,
  `pnpm test -- tests/unit/feed-surface`,
  `pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts`,
  and `pnpm rust-wasm:quiet`.
- Completion proof: a Rust feed view model renders real rows from SQLite cache
  evidence plus relay snapshots. Missing coverage never proves absence, hidden
  tabs release live relay work, and no placeholder rows exist.

## 4. First Home Leptos feed slice

Render first Home Leptos feed rows from real Rust view models without claiming
broader surface parity.

- Cutover-ledger row: [Home](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [Home product](../product/feeds/home.md),
  [followees product](../product/feeds/followees.md),
  [Home runtime](../architecture/runtimes/home-runtime.md),
  [Home feed source](../architecture/feeds/sources/home.md), and
  [UI runtime](../architecture/rust-wasm/ui-runtime.md).
- Crates: `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, `lkjstr-ui`, and
  `lkjstr-web`.
- Shipped source paths: `crates/lkjstr-app/src/home*`,
  `crates/lkjstr-ui/src/home*`, `src/lib/timeline/`,
  `src/lib/tabs/timeline/`, `src/lib/backend/`, `tests/unit/timeline/`, and
  `tests/unit/workspace/tab-retention.test.ts`.
- Focused tests: `cargo test -p lkjstr-app -- home`,
  `cargo test -p lkjstr-ui -- home`,
  `pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts`,
  `pnpm test -- tests/unit/workspace/tab-retention.test.ts`, and
  `pnpm rust-wasm:quiet`.
- Completion proof: Home rows come from the shared Rust feed model,
  unavailable states are truthful, clean startup behavior remains, and
  TypeScript Home runtime remains until deletion proof is complete.

## 5. Deletion proof

Prove imports are gone before deleting replaced TypeScript or Svelte product
paths.

- Cutover-ledger row: [Deletion ledger](../architecture/rust-wasm/cutover/deletion-ledger.md).
- Docs to read: [cutover README](../architecture/rust-wasm/cutover/README.md),
  [deletion ledger](../architecture/rust-wasm/cutover/deletion-ledger.md),
  [parity ledger](../architecture/rust-wasm/cutover/parity-ledger.md),
  [TypeScript inventory](../architecture/rust-wasm/cutover/typescript-inventory.md),
  and [workflow](../repository/workflow.md).
- Crates: replacement crate set named by the surface row.
- Shipped source paths: exact removed files under `src/lib/**` or
  `src/routes/**`, replacement Rust paths under `crates/lkjstr-*`, and tests
  under the surface focused gate.
- Focused tests: `rg` no-import proof for the target paths,
  `pnpm check:repo`, surface focused Rust tests, surface focused TypeScript
  tests while Svelte remains owner, `pnpm verify:quiet`, and Docker final gate
  before broad deletion claims.
- Completion proof: deletion ledger names removed files, replacement Rust paths,
  no-import command output, focused tests, and actual final-gate status. No
  partial row allows deletion.
