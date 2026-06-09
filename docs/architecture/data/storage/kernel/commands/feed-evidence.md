# Feed Evidence Commands

## Purpose

Feed evidence command metadata covers cursor rows, coverage rows, scan hints,
and same-batch cache ledger writes. Coverage reads preserve the semantic feed
key, route group where present, filter fingerprint, interval, relay URL, density,
and completion evidence. Missing, stale, failed, compacted, dense, or incomplete
evidence cannot prove absence.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `feed-evidence.cursor.put` | implemented | feed-evidence | transaction | `FeedCursorPutInput` | `FeedCursorPutOutput` | `feed_cursors.upsert`, `cache_ledger.upsert` | `feed_cursors`, `cache_ledger` | `sqlite_feed_cursor_row`, `sqlite_cache_ledger_row` | cache decode, write/quota | derived-feed-cache, ledger | same-batch | recoverable-cache | cache-summary | `sqlite_store/feed_cache.rs` | `feed-coverage-store.ts`, `feed-cache-sqlite.ts` | `commands_feed_cache_test.rs` | Rust feed parity plus no-import proof |
| `feed-evidence.cursor.get` | implemented | feed-evidence | read | `FeedCursorGetInput` | `FeedCursorGetOutput` | `feed_cursors.select` | `feed_cursors` | `sqlite_feed_cursor_row` | cache decode | derived-feed-cache | none | recoverable-cache | none | `sqlite_store/feed_cache.rs` | `feed-coverage-store.ts`, `feed-cache-sqlite.ts` | `commands_feed_cache_test.rs` | Rust feed parity plus no-import proof |
| `feed-evidence.coverage.put` | implemented | feed-evidence | transaction | `FeedCoveragePutInput` | `FeedCoveragePutOutput` | `feed_coverage.upsert`, `cache_ledger.upsert` | `feed_coverage`, `cache_ledger` | `sqlite_feed_coverage_row`, `sqlite_cache_ledger_row` | cache decode, write/quota | derived-feed-cache, ledger | same-batch | recoverable-cache | cache-summary | `sqlite_store/feed_cache.rs` | `feed-coverage-store.ts`, `feed-cache-sqlite.ts` | `commands_feed_cache_test.rs` | Rust feed parity plus no-import proof |
| `feed-evidence.coverage.for-feed` | implemented | feed-evidence | read | `FeedCoverageForFeedInput` | `FeedCoverageForFeedOutput` | `feed_coverage.by_feed` | `feed_coverage` | `feed_coverage_from_sqlite_row` | cache decode | derived-feed-cache | none | recoverable-cache | none | `sqlite_store/feed_cache.rs` | `feed-coverage-store.ts`, `feed-cache-sqlite.ts` | `commands_feed_cache_test.rs` | Rust feed parity plus no-import proof |
| `feed-evidence.scan-hint.put` | implemented | feed-evidence | transaction | `FeedScanHintPutInput` | `FeedScanHintPutOutput` | `feed_scan_hints.upsert`, `cache_ledger.upsert` | `feed_scan_hints`, `cache_ledger` | `sqlite_feed_scan_hint_row`, `sqlite_cache_ledger_row` | cache decode, write/quota | derived-feed-cache, ledger | same-batch | recoverable-cache | cache-summary | `sqlite_store/feed_cache.rs` | `feed-coverage-store.ts`, `feed-cache-sqlite.ts` | `commands_feed_cache_test.rs` | Rust feed parity plus no-import proof |
| `feed-evidence.scan-hints.for-feed` | implemented | feed-evidence | read | `FeedScanHintsForFeedInput` | `FeedScanHintsForFeedOutput` | `feed_scan_hints.by_feed` | `feed_scan_hints` | `sqlite_feed_scan_hint_row` | cache decode | derived-feed-cache | none | recoverable-cache | none | `sqlite_store/feed_cache.rs` | `feed-coverage-store.ts`, `feed-cache-sqlite.ts` | `commands_feed_cache_test.rs` | Rust feed parity plus no-import proof |

## Proof Rule

A cached feed page may render as complete only when coverage evidence is complete
for every required relay, route group, semantic key, filter shape, and bounded
interval. The command specs do not turn a cache miss into absence proof.
