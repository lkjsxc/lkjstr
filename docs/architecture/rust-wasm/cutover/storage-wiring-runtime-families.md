# Runtime Storage Families

## Purpose

This file owns cache, diagnostics, feed, and optimizer storage family source maps split from [storage-wiring-families.md](storage-wiring-families.md).

## Storage Families

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
  Global, Notifications, Profile, Thread, Search, Author Context, and User
  Timeline cached rows consume matching models first.
- Worker message: `query` and `batch`.
- Row codec and proof: optimizer scan-model command metadata,
  `commands_optimizer_test.rs`, optimizer unit tests, and scan-model repository
  tests.
- Deletion condition: Stats and every converted feed runtime consume Rust
  optimizer and geometry rows without TypeScript session fallbacks.
