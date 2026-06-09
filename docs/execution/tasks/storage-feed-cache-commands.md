# Storage Feed Cache Commands

## Purpose

Add truthful command metadata and focused proof for event-cache, feed-cursor,
feed-coverage, scan-hint, and cached-feed-page SQLite worker calls.

## Status

Implemented for event-cache, feed-cursor, feed-coverage, and scan-hint command
metadata. Product feed runtime consumption remains partial.

## Current Evidence

- Rust row codecs exist for events, tags, relay provenance, feed cursors, feed
  coverage, and scan hints.
- `lkjstr-web/src/sqlite_store/events.rs` and `feed_cache.rs` expose worker
  calls used by storage and feed paths, and each exported call has command
  metadata.
- Shipped Svelte feed surfaces still use TypeScript repositories until Rust feed
  runtime parity exists.

## Target Behavior

Event and feed commands name every statement and table touched by the batch.
Ledger-backed writes store resource rows and `cache_ledger` rows in the same
batch. Coverage reads preserve route group, semantic key, filter shape, interval,
and relay evidence. Incomplete, failed, stale, compacted, dense, or missing
coverage cannot prove absence.

## Docs To Update First

- `docs/architecture/data/feed-coverage.md` when proof semantics change.
- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/events.rs`.
- `crates/lkjstr-storage/src/feed_cache.rs`.
- `crates/lkjstr-storage/src/commands/events.rs`.
- `crates/lkjstr-storage/src/commands/feed_cache.rs`.
- `crates/lkjstr-web/src/sqlite_store/events.rs`.
- `crates/lkjstr-web/src/sqlite_store/feed_cache.rs`.
- `crates/lkjstr-web/tests/sqlite_store_test.rs`.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/storage/sqlite-opfs/**`, `src/lib/storage/repositories/**`,
`src/lib/events/**`, and shipped feed tab surfaces until Rust feed parity and
no-import proof exist.

## Tests To Add Or Update

- Event put metadata includes event, tag, relay provenance, and ledger statements.
- Feed coverage writes declare same-batch ledger policy.
- Feed coverage reads reject stale, incomplete, compacted, failed, dense, or
  missing evidence as absence proof.
- Worker calls preserve route group, semantic key, filter shape, interval, and
  relay evidence.
- TypeScript repository tests still pass while Svelte remains shipped runtime.

## Focused Gate

```sh
cargo test -p lkjstr-storage commands
cargo test -p lkjstr-storage feed_cache
cargo test -p lkjstr-web feed_cache
pnpm test -- tests/unit/events/repository.test.ts
pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts
```

## Final Gate

Run Docker Compose final verification before claiming feed cache cutover or
deleting TypeScript repository paths.

## Commit Boundary

Keep event-cache command metadata and feed-evidence command metadata in separate
commits unless shared tests require one batch.

## Must Not

- Do not let a cache miss prove event absence.
- Do not split ledger rows into a later best-effort write.
- Do not format product SQL outside storage-owned records.
- Do not delete shipped Svelte feed runtime paths from metadata work.
