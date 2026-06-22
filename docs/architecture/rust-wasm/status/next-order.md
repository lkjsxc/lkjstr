# Next Order

## Purpose

Next rust/wasm execution order.

## Details

Use [surface-cutover-order.md](../surface-cutover-order.md) for dependency rank,
[cutover/implementation-ledger.md](../cutover/implementation-ledger.md) for owner
and dependency rows, and [cutover/verification-ledger.md](../cutover/verification-ledger.md)
for checks. Each executable slice records docs touched, Rust crates touched,
replaced TypeScript or Svelte paths, focused gate, and final gate.

### SQLite Feed And Diagnostics Wiring

- Docs touched: this file, [storage-kernel.md](../storage-kernel.md),
  [../data/sqlite-opfs/repositories.md](../../data/sqlite-opfs/repositories.md),
  [cutover/areas/storage.md](../cutover/areas/storage.md),
  [cutover/parity-ledger.md](../cutover/parity-ledger.md), and
  [cutover/deletion-ledger.md](../cutover/deletion-ledger.md).
- Rust crates touched: `lkjstr-storage`, `lkjstr-web`, `lkjstr-app`, and
  `lkjstr-ui` when view-model fields change.
- TypeScript or Svelte paths replaced: none deleted until feed evidence,
  diagnostics, retention, tab snapshots, and no-import proof are complete.
- Current sub-slice: Stats consumes real SQLite worker health through the Rust
  storage worker adapter. Event-cache, feed-coverage, active-account selector,
  and pressure snapshot Rust row codecs plus `lkjstr-web` worker repository
  calls exist. Accounts now uses the SQLite active selector row and migrates the
  old localStorage key only when needed. Command metadata now has statement and
  table arrays plus ledger, protection, and Stats policy enums. Live protected,
  event cache, feed evidence, relay diagnostics, notifications, jobs, app log,
  pressure, and inventory worker calls now have command specs. Optimizer
  metadata, retention planner metadata, retention delete dispatch,
  storage-owned repair command models plus basic worker adapters, pressure
  byte-summary Stats rows, localStorage count/status/bytes, Cache Storage
  count/status/response bytes, old IndexedDB presence, explicit Stats
  storage-action capability states, report-only repair host action, and Search
  token/tag/query metadata are implemented; full product cache proof, Search app
  planning, NIP-50 merge, mutating repair/compaction action adapters, and
  surface consumption remain open.
- Focused gate: `cargo test -p lkjstr-storage` and `pnpm rust-wasm:quiet`.
- Final gate: Docker Compose config, image builds, and service runs from
  [../../operations/verification.md](../../../operations/verification.md).

### Relay Product Wiring

- Docs touched: [relay-runtime.md](../relay-runtime.md),
  [../network/subscription-orchestration/README.md](../../network/subscription-orchestration/README.md),
  and request-budget docs.
- Rust crates touched: `lkjstr-relays`, `lkjstr-web`, and `lkjstr-app`.
- TypeScript or Svelte paths replaced: `src/lib/relays` pieces only after
  synthetic relay proof and surface parity.
- Focused gate: `cargo test -p lkjstr-relays` and relay orchestration unit
  tests.
- Final gate: Docker Compose final gate.

### Shared Feed Runtime

- Docs touched: [../feeds/runtime/README.md](../../feeds/runtime/README.md),
  [../data/feed-surface/README.md](../../data/feed-surface/README.md), this file,
  and parity ledgers.
- Rust crates touched: `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, and
  `lkjstr-ui`.
- TypeScript or Svelte paths replaced: `src/lib/feed-surface`, feed-specific
  runtime code, and tab surfaces only after Leptos parity.
- Focused gate: `cargo test -p lkjstr-app -- feed` plus feed surface unit tests.
- Final gate: Docker Compose final gate.

### Surface Cutover

- Docs touched: product feed or tool contract, runtime contract, parity ledger,
  deletion ledger, and concise audit.
- Rust crates touched: surface-specific `lkjstr-app` model, `lkjstr-ui` view,
  `lkjstr-web` host adapters, and shared lower crates as needed.
- TypeScript or Svelte paths replaced: exact module group in the deletion
  ledger.
- Focused gate: surface-specific gate from
  [../../operations/focused-gates.md](../../../operations/focused-gates.md).
- Final gate: Docker Compose final gate before cutover claims.
