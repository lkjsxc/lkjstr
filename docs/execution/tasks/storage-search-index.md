# Storage Search Index

## Purpose

Define the storage-side task for Rust local search and tag lookup rows without
skipping storage, relay, or feed dependency order.

## Status

Partial. Storage-owned token rows, command metadata, SQL table/index records,
event-write token batch steps, and local indexed query adapters exist. Product
Search runtime parity remains a later surface task.

## Current Evidence

- Shipped search still has a SQLite token-index path in TypeScript storage glue.
- Rust storage owns tokenization, token row codecs, search SQL table/index
  records, tag lookup metadata, update-event-index metadata, and local-query
  metadata.
- `crates/lkjstr-web/src/sqlite_store/search.rs` exposes local indexed query
  adapters and event-write token batch steps.
- App-level planner, relay NIP-50 merge, Leptos Search parity, and no-import
  proof remain open.

## Next Edit

1. Keep shipped TypeScript Search paths active.
2. Keep relay NIP-50 merge decisions in app and relay runtime code.
3. Keep shipped TypeScript Search paths until Rust indexed rows have no-import
   proof.

## Next Checklist

- [ ] Read Search product docs, SQLite repository contracts, and TypeScript
  search-index and event-matching paths.
- [x] Update storage command matrix docs before adding Rust search commands.
- [x] Add tag lookup and token row codecs without changing product Search
  parity status.
- [x] Add command specs for `tag-lookup.by-value`, `search.local-query`, and
  `search.update-event-index` as real repositories land.
- [x] Add tests for token row codecs, tag lookup metadata, indexed local-query
  metadata, and update-event-index metadata.
- [x] Run Rust storage search and command tests plus shipped TypeScript Search
  tests; record actual verification.
- [x] Add local query worker adapter compile proof.
- [ ] Add product planner, NIP-50 merge, and UI parity tests.

## Acceptance

Rust storage owns token row codecs, tag lookup command metadata, indexed local
query commands, and delete/update commands for cached event changes. Product
search never falls back to full cached-event scans for normal local search.
NIP-50 merge state stays in app and relay runtime modules, not storage.

## Files To Read

- `docs/product/tools/search.md`.
- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `crates/lkjstr-storage/src/search.rs`.
- `crates/lkjstr-web/src/sqlite_store/search.rs`.

## Docs To Update First

- `docs/product/tools/search.md` if visible behavior changes.
- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/parity-ledger.md` when search status changes.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Files To Touch

- `crates/lkjstr-storage/src/search.rs`.
- `crates/lkjstr-storage/src/commands/search.rs`.
- `crates/lkjstr-storage/src/events.rs` for tag lookup linkage when needed.
- `crates/lkjstr-web/src/sqlite_store/events.rs` for tag lookup bridging.
- `crates/lkjstr-web/src/sqlite_store/search.rs` for local query and token batch
  adapters.
- Later product work belongs in `crates/lkjstr-app` search modules.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/search/**`, `src/lib/storage/sqlite-opfs/search-index-sqlite.ts`,
`src/lib/storage/repositories/search-index-store.ts`, and Search tab surfaces
until Rust search parity and no-import proof exist.

## Tests To Add Or Update

- Token insert, delete, and query row codecs.
- Tag lookup query command specs.
- Event cache update removes stale search tokens before inserting new tokens.
- Local search uses indexed rows, not a full cached-event scan.
- TypeScript Search tests still pass while shipped Search remains TypeScript-owned.

## Focused Gate

```sh
cargo test -p lkjstr-storage search
cargo test -p lkjstr-storage commands
cargo test -p lkjstr-web sqlite_store
pnpm test -- tests/unit/search
pnpm test -- tests/unit/storage/sqlite-opfs-events.test.ts
```

## Final Gate

Run Docker Compose final verification before Search parity or deletion claims.

## Commit Boundary

Keep storage token/index command metadata separate from app-level NIP-50 merge
or Leptos Search work.

## Must Not

- Do not prioritize Search ahead of storage command coverage, relay wiring, and
  shared feed runtime.
- Do not implement full-scan local search as the normal product path.
- Do not put relay NIP-50 merge decisions in storage.
- Do not delete TypeScript Search paths from storage-only work.
