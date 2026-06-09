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
- Next source edit: repair command models and worker adapters.
- Focused tests: `cargo test -p lkjstr-storage retention`,
  `cargo test -p lkjstr-web retention`, `cargo test -p lkjstr-web cache_ledger`,
  cache unit tests, and `pnpm rust-wasm:quiet`.
- Ledgers: storage area and verification ledger after checks; deletion ledger
  only with no-import proof.
- Keep: TypeScript storage repositories, SQLite OPFS glue, cache maintenance,
  Search storage, and Svelte Stats/cache tabs until Rust parity exists.

## Current Evidence

- Rust manifest and row codecs: `crates/lkjstr-storage/src/**`.
- Batch-capable command metadata shape and matrix:
  `crates/lkjstr-storage/src/commands/**` and
  [../../data/storage/kernel/commands/README.md](../../data/storage/kernel/commands/README.md).
- Rust worker adapter and repository calls: `crates/lkjstr-web/src/sqlite_store/**`
  and `crates/lkjstr-web/src/storage_worker/**`.
- Current TypeScript worker glue: `src/lib/storage/sqlite-opfs/**` and
  `src/lib/storage/repositories/**`.
- Focused proof runs for storage slices are recorded in
  [verification-ledger.md](verification-ledger.md). Recent storage cargo,
  Vitest, docs, style, and line gates pass; `pnpm rust-wasm:quiet` currently
  reaches wasm-pack and then fails in the existing Chrome harness path.
- Product cutover remains partial because shipped Svelte surfaces still call
  TypeScript repositories for many live reads and maintenance operations.

## Worker Message Contract

`lkjstr-storage` owns table names, SQL statement ids, row codecs, data classes,
ledger resource kinds, command metadata, and typed outcomes. Command metadata
must describe batch-shaped operations by statement ids, tables, ledger policy,
protection policy, and Stats projection instead of one-table shorthand.
`lkjstr-web` sends worker messages through `StorageOp`: `open`, `apply-schema`,
`query`, `execute`, `batch`, `get-storage-health`,
`read-physical-inventory`, `estimate-storage`, `cancel`, and `close`. Product
crates never format SQL or open OPFS. Accounts active selection reads and writes
the protected SQLite selector row; the old `lkjstr.activeAccountId` localStorage
key is migration-only and is removed after a successful selector write. Active
selector, pressure, protected rows, event cache, feed evidence, diagnostics,
notifications, jobs, app log, and inventory snapshot now use the batch-capable
metadata shape. Optimizer scan-model command metadata is implemented;
retention planner, command metadata, and delete dispatch adapter are
implemented. Search token rows, tag lookup metadata, event-write token batch
steps, and local indexed query adapters are implemented. Retention product
consumption, pressure inventory completion, Search app planning, NIP-50 merge,
and surface parity remain open.

## Storage Family Matrix

| Family                                              | Current TypeScript path                                                                                  | Rust storage and web path                                                                                              | Worker message   | Row codec and proof                                 | Deletion condition                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Accounts and active selector                        | `repositories/accounts-store.ts`, `sqlite-opfs/accounts-sqlite.ts`, old `lkjstr.activeAccountId` key      | `lkjstr-storage/src/accounts.rs`, `active_account.rs`, `lkjstr-web/src/sqlite_store/accounts.rs`, `active_account.rs` | `query`, `batch` | `accounts_test.rs`, `active_account_test.rs`, Accounts host tests | Leptos Accounts owns local, read-only, NIP-07, selector migration, and no TS imports.         |
| Local signing secrets                               | `repositories/secrets-store.ts`, `sqlite-opfs/accounts-sqlite.ts`                                        | `lkjstr-storage/src/local_secrets.rs`, `sqlite_store/accounts.rs`                                                      | `query`, `batch` | `accounts_test.rs`                                  | Protected and unprotected signer records have Rust UI, redaction, migration, and tests.       |
| Settings                                            | `repositories/settings-store.ts`, `sqlite-opfs/settings-sqlite.ts`                                       | `lkjstr-storage/src/settings*.rs`, `sqlite_store/settings.rs`                                                          | `query`, `batch` | `settings_schema_test.rs`, `settings_test.rs`       | Settings side effects and flat editor are Rust-owned.                                         |
| Relay sets                                          | `repositories/relay-sets-store.ts`, `sqlite-opfs/relay-sets-sqlite.ts`                                   | `lkjstr-storage/src/relay_sets.rs`, `sqlite_store/relay_sets.rs`                                                       | `query`, `batch` | `relay_sets_test.rs`                                | Relay Settings reads, writes, defaults, and diagnostics are Rust-owned.                       |
| Workspace layout                                    | `repositories/workspace-store.ts`, `sqlite-opfs/workspace-sqlite.ts`                                     | `lkjstr-storage/src/workspace.rs`, `sqlite_store/workspaces.rs`                                                        | `query`, `batch` | `workspace_test.rs`                                 | Root Rust shell restores, persists, and recovers from worker failure.                         |
| Tab snapshots                                       | `repositories/tab-states-store.ts`, `sqlite-opfs/tab-states-sqlite.ts`                                   | `lkjstr-storage/src/tab_state.rs`, `sqlite_store/tab_states.rs`                                                        | `query`, `batch` | `tab_state_test.rs`                                 | All Leptos tabs serialize bounded snapshots and no Svelte tab store imports remain.           |
| Tweet drafts                                        | `repositories/tweet-drafts-store.ts`, `sqlite-opfs/tweet-drafts-sqlite.ts`                               | `lkjstr-storage/src/tweet_drafts.rs`, `sqlite_store/tweet_drafts.rs`                                                   | `query`, `batch` | `tweet_drafts_test.rs`                              | Rust Tweet editor owns drafts and publish queue handoff.                                      |
| Jobs                                                | `repositories/jobs-store.ts`, `sqlite-opfs/jobs-sqlite.ts`                                               | `lkjstr-storage/src/jobs.rs`, `sqlite_store/jobs.rs`                                                                   | `query`, `batch` | `diagnostics_sqlite_rows_test.rs`                   | Publish, upload, retention, and repair jobs are Rust-owned and Stats-visible.                 |
| Route blocks                                        | `repositories/route-blocks-store.ts`, `sqlite-opfs/relay-cache-sqlite.ts`                                | `lkjstr-storage/src/route_blocks.rs`, `sqlite_store/relay_routes.rs`                                                   | `query`, `batch` | `diagnostics_sqlite_rows_test.rs`                   | Relay routing ignores blocked routes through Rust planners only.                              |
| Cached events, tags, graph, provenance              | `repositories/events-store.ts`, `sqlite-opfs/events-sqlite.ts`                                           | `lkjstr-storage/src/events.rs`, `sqlite_store/events.rs`                                                               | `query`, `batch` | `event_cache_sqlite_rows_test.rs`                   | Rust validates, writes, queries, prunes, and proves cache-hit rows for feeds.                 |
| Feed cursors, pages, coverage                       | `repositories/feed-coverage-store.ts`, `sqlite-opfs/feed-cache-sqlite.ts`                                | `lkjstr-storage/src/feed_cache.rs`, `sqlite_store/feed_cache.rs`                                                       | `query`, `batch` | `feed_cache_sqlite_rows_test.rs`                    | Rust feed runtime accepts only complete coverage proof before empty or cache-hit states.      |
| Tag lookup and local filter search                  | `event-matching-store.ts`, `search-index-store.ts`, `event-matching-sqlite.ts`, `search-index-sqlite.ts` | `lkjstr-storage/src/search.rs`, `commands/search.rs`, `sql/search.rs`; `sqlite_store/search.rs` token batches and local query | `query`, `batch` | `search_test.rs`, `commands_search_test.rs`, `sql_schema_test.rs` | App planner, NIP-50 merge, Leptos parity, and no-import proof.                                |
| Relay diagnostics, info, suggestions, author routes | `relay-*-store.ts`, `sqlite-opfs/relay-cache-sqlite.ts`                                                  | `lkjstr-storage/src/diagnostics.rs`, `sqlite_store/relay_*`                                                            | `query`, `batch` | `diagnostics_sqlite_rows_test.rs`                   | Relay Settings and Stats use Rust rows, route evidence, and import-only suggestions.          |
| Notifications                                       | `repositories/notifications-store.ts`, `sqlite-opfs/notifications-sqlite.ts`                             | `lkjstr-storage/src/notifications.rs`, `sqlite_store/notifications.rs`                                                 | `query`, `batch` | `notifications_sqlite_rows_test.rs`                 | Rust Notifications runtime owns rows, references, and bounded paging.                         |
| App log                                             | `src/lib/log/**`, `sqlite-opfs/app-log-repository.ts`                                                    | `lkjstr-storage/src/app_log.rs`, `sqlite_store/app_log.rs`                                                             | `query`, `batch` | `diagnostics_sqlite_rows_test.rs`                   | Rust Log owns capture, redaction, display, refresh, clear, and bounds.                        |
| Cache ledger and retention metadata                 | `sqlite-opfs/cache-ledger-*.ts`, `cache-compaction-sqlite.ts`                                            | `lkjstr-storage/src/ledger.rs`, `retention/**`, `tab_state.rs`, `lkjstr-web/src/retention_dispatch.rs`, `sqlite_store/cache_ledger.rs`, `sqlite_store/retention.rs` | `query`, `batch` | `ledger_test.rs`, `manifest_test.rs`, `retention_test.rs`, `commands_retention_test.rs`, `sqlite_retention_store_test.rs` | Rust retention product consumption plus no-import proof.                                      |
| Optimizer and geometry observations                 | `feed-surface/scan-model-repository.ts`, `sqlite-opfs/feed-cache-*`                                      | `lkjstr-storage/src/optimizer/**`, `lkjstr-storage/src/commands/optimizer.rs`, `lkjstr-web/src/scan_model/**`; add durable row-height rows before geometry cutover | `query`, `batch` | optimizer scan-model command metadata; `commands_optimizer_test.rs`; `optimizer::tests*`, `scan-model-repository` tests | Stats and feed runtime consume Rust optimizer and geometry rows without TS session fallbacks. |

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
