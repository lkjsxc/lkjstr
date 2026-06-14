# Storage Wiring Cutover

## Purpose

This contract maps every live storage family from TypeScript SQLite worker code
to the Rust storage manifest, Rust row codecs, worker messages, tests, and the
condition that allows TypeScript product storage deletion.

## Agent Start

- Current source owner: shipped TypeScript SQLite worker repositories, with Rust
  worker calls already present for protected rows, cache evidence, diagnostics,
  optimizer rows, pressure rows, inventory, and app log.
- Desired Rust owner: storage command specs in `lkjstr-storage`, worker effects
  in `lkjstr-web`, and product consumption in `lkjstr-app` and `lkjstr-ui`.
- Next source edit: retention and repair product consumption through the
  storage-owned inventory readiness signal.
- Focused tests: `cargo test -p lkjstr-storage pressure`,
  `cargo test -p lkjstr-storage stats`, `cargo test -p lkjstr-storage commands`,
  `cargo test -p lkjstr-ui stats`, touched web adapter tests, cache unit tests,
  and `pnpm rust-wasm:quiet`.
- Ledgers: storage area and verification ledger after checks; deletion ledger
  only with no-import proof.
- Keep: TypeScript storage repositories, SQLite OPFS glue, cache maintenance,
  Search storage, and Svelte Stats/cache tabs until Rust parity exists.

## Current Evidence

- Rust manifest and row codecs: `crates/lkjstr-storage/src/**`.
- Batch-capable command metadata shape and matrix:
  `crates/lkjstr-storage/src/commands/**` and
  [../../data/storage/kernel/commands/README.md](../../data/storage/kernel/commands/README.md).
- Rust worker adapter and repository calls:
  `crates/lkjstr-web/src/sqlite_store/**` and
  `crates/lkjstr-web/src/storage_worker/**`.
- Current TypeScript worker glue: `src/lib/storage/sqlite-opfs/**` and
  `src/lib/storage/repositories/**`.
- Focused proof runs for storage slices are recorded in
  [verification-ledger.md](verification-ledger.md). Recent storage cargo,
  Vitest, docs, style, line, and Rust/WASM quiet gates pass when the real Cargo
  path is placed before the local shim.
- Product cutover remains partial because shipped Svelte surfaces still call
  TypeScript repositories for many live reads and maintenance operations.

## Worker Message Contract

`lkjstr-storage` owns table names, SQL statement ids, row codecs, data classes,
ledger resource kinds, command metadata, and typed outcomes. Command metadata
must describe batch-shaped operations by statement ids, tables, ledger policy,
protection policy, and Stats projection instead of one-table shorthand.

`lkjstr-web` sends worker messages through `StorageOp`: `open`, `apply-schema`,
`query`, `execute`, `batch`, `get-storage-health`, `read-physical-inventory`,
`estimate-storage`, `cancel`, and `close`. Product crates never format SQL or
open OPFS.

Accounts active selection reads and writes the protected SQLite selector row.
The old `lkjstr.activeAccountId` localStorage key is migration-only and is
removed after a successful selector write.

Active selector, pressure, protected rows, event cache, feed evidence,
diagnostics, notifications, jobs, app log, inventory snapshot, optimizer rows,
retention planner, retention delete dispatch, repair scan, repair backfill,
repair inventory report, repair target probes, Search token rows, tag lookup,
event-write token batch steps, and local indexed Search query adapters are
implemented at the storage and web-adapter boundary.

Rust app retention and repair planning consumes the storage-owned readiness
classifier. Search app planning, NIP-50 merge, and surface parity remain open.
Pressure inventory has a storage-owned readiness classifier, while browser byte
estimates remain open.

## Storage Families

### Accounts and active selector

- Current TypeScript path: `repositories/accounts-store.ts`,
  `sqlite-opfs/accounts-sqlite.ts`, and old `lkjstr.activeAccountId` key.
- Rust storage and web path: `lkjstr-storage/src/accounts.rs`,
  `active_account.rs`, `lkjstr-web/src/sqlite_store/accounts.rs`, and
  `active_account.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `accounts_test.rs`, `active_account_test.rs`, and
  Accounts host tests.
- Deletion condition: Leptos Accounts owns local, read-only, NIP-07, selector
  migration, and no TypeScript imports.

### Local signing secrets

- Current TypeScript path: `repositories/secrets-store.ts` and
  `sqlite-opfs/accounts-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/local_secrets.rs` and
  `sqlite_store/accounts.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `accounts_test.rs`.
- Deletion condition: protected and unprotected signer records have Rust UI,
  redaction, migration, and tests.

### Settings

- Current TypeScript path: `repositories/settings-store.ts` and
  `sqlite-opfs/settings-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/settings*.rs` and
  `sqlite_store/settings.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `settings_schema_test.rs` and `settings_test.rs`.
- Deletion condition: Settings side effects and flat editor are Rust-owned.

### Relay sets

- Current TypeScript path: `repositories/relay-sets-store.ts` and
  `sqlite-opfs/relay-sets-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/relay_sets.rs` and
  `sqlite_store/relay_sets.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `relay_sets_test.rs`.
- Deletion condition: Relay Settings reads, writes, defaults, and diagnostics
  are Rust-owned.

### Workspace layout

- Current TypeScript path: `repositories/workspace-store.ts` and
  `sqlite-opfs/workspace-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/workspace.rs` and
  `sqlite_store/workspaces.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `workspace_test.rs`.
- Deletion condition: root Rust shell restores, persists, and recovers from
  worker failure.

### Tab snapshots

- Current TypeScript path: `repositories/tab-states-store.ts` and
  `sqlite-opfs/tab-states-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/tab_state.rs` and
  `sqlite_store/tab_states.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `tab_state_test.rs`.
- Deletion condition: all Leptos tabs serialize bounded snapshots and no Svelte
  tab store imports remain.

### Tweet drafts

- Current TypeScript path: `repositories/tweet-drafts-store.ts` and
  `sqlite-opfs/tweet-drafts-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/tweet_drafts.rs` and
  `sqlite_store/tweet_drafts.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `tweet_drafts_test.rs`.
- Deletion condition: Rust Tweet editor owns drafts and publish queue handoff.

### Jobs

- Current TypeScript path: `repositories/jobs-store.ts` and
  `sqlite-opfs/jobs-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/jobs.rs` and
  `sqlite_store/jobs.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `diagnostics_sqlite_rows_test.rs`.
- Deletion condition: publish, upload, retention, and repair jobs are Rust-owned
  and Stats-visible.

### Route blocks

- Current TypeScript path: `repositories/route-blocks-store.ts` and
  `sqlite-opfs/relay-cache-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/route_blocks.rs` and
  `sqlite_store/relay_routes.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `diagnostics_sqlite_rows_test.rs`.
- Deletion condition: relay routing ignores blocked routes through Rust planners
  only.

### Cached events, tags, graph, and provenance

- Current TypeScript path: `repositories/events-store.ts` and
  `sqlite-opfs/events-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/events.rs` and
  `sqlite_store/events.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `event_cache_sqlite_rows_test.rs`.
- Deletion condition: Rust validates, writes, queries, prunes, and proves
  cache-hit rows for feeds.

### Feed cursors, pages, and coverage

- Current TypeScript path: `repositories/feed-coverage-store.ts` and
  `sqlite-opfs/feed-cache-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/feed_cache.rs` and
  `sqlite_store/feed_cache.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `feed_cache_sqlite_rows_test.rs`.
- Deletion condition: Rust feed runtime accepts only complete coverage proof
  before empty or cache-hit states.

### Tag lookup and local filter search

- Current TypeScript path: `event-matching-store.ts`,
  `search-index-store.ts`, `event-matching-sqlite.ts`, and
  `search-index-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/search.rs`,
  `commands/search.rs`, `sql/search.rs`, and `sqlite_store/search.rs` token
  batches plus local query.
- Worker message: `query` and `batch`.
- Row codec and proof: `search_test.rs`, `commands_search_test.rs`, and
  `sql_schema_test.rs`.
- Deletion condition: app planner, NIP-50 merge, Leptos parity, and no-import
  proof.

### Relay diagnostics, info, suggestions, and author routes

- Current TypeScript path: `relay-*-store.ts` and
  `sqlite-opfs/relay-cache-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/diagnostics.rs` and
  `sqlite_store/relay_*`.
- Worker message: `query` and `batch`.
- Row codec and proof: `diagnostics_sqlite_rows_test.rs`.
- Deletion condition: Relay Settings and Stats use Rust rows, route evidence,
  and import-only suggestions.

### Notifications

- Current TypeScript path: `repositories/notifications-store.ts` and
  `sqlite-opfs/notifications-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/notifications.rs` and
  `sqlite_store/notifications.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `notifications_sqlite_rows_test.rs`.
- Deletion condition: Rust Notifications runtime owns rows, references, and
  bounded paging.

### App log

- Current TypeScript path: `src/lib/log/**` and
  `sqlite-opfs/app-log-repository.ts`.
- Rust storage and web path: `lkjstr-storage/src/app_log.rs` and
  `sqlite_store/app_log.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `diagnostics_sqlite_rows_test.rs`.
- Deletion condition: Rust Log owns capture, redaction, display, refresh,
  clear, and bounds.

### Cache ledger and retention metadata

- Current TypeScript path: `sqlite-opfs/cache-ledger-*.ts` and
  `cache-compaction-sqlite.ts`.
- Rust storage and web path: `lkjstr-storage/src/ledger.rs`, `retention/**`,
  `tab_state.rs`, `lkjstr-web/src/retention_dispatch.rs`,
  `sqlite_store/cache_ledger.rs`, and `sqlite_store/retention.rs`.
- Worker message: `query` and `batch`.
- Row codec and proof: `ledger_test.rs`, `manifest_test.rs`,
  `retention_test.rs`, `commands_retention_test.rs`, and
  `sqlite_retention_store_test.rs`.
- Deletion condition: Rust retention product consumption plus no-import proof.

### Optimizer and geometry observations

- Current TypeScript path: `feed-surface/scan-model-repository.ts` and
  `sqlite-opfs/feed-cache-*`.
- Rust storage and web path: `lkjstr-storage/src/optimizer/**`,
  `lkjstr-storage/src/commands/optimizer.rs`,
  `lkjstr-web/src/scan_model/**`, and typed `feed_row_height_*` rows. Home,
  Global, and Notifications cached feed rows consume matching models first.
- Worker message: `query` and `batch`.
- Row codec and proof: optimizer scan-model command metadata,
  `commands_optimizer_test.rs`, optimizer unit tests, and scan-model repository
  tests.
- Deletion condition: Stats and every converted feed runtime consume Rust
  optimizer and geometry rows without TypeScript session fallbacks.

## Deletion Proof

For any row, record the exact Rust replacement files in
[deletion-ledger.md](deletion-ledger.md), run the focused gate, then prove no
imports of the TypeScript path remain with `rg` over `src`, `tests`, and
`scripts`. Deletion happens in the same coherent change as the ledger update.

## Must Not Clauses

- No fake data.
- No placeholder success.
- No direct browser database access from product code.
- No unbounded arrays.
- No hidden global state.
- No deletion before parity proof.
- No status claim without source/test evidence.
