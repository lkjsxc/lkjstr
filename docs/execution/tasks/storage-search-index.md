# Storage Search Index

## Purpose

Define the storage-side task for Rust local search and tag lookup rows without
skipping storage, relay, or feed dependency order.

## Status

Queued. Implement only storage-owned row and command work here; product search
runtime parity remains a later surface task.

## Current Evidence

- Shipped search has a SQLite token-index path in TypeScript storage glue.
- Rust protocol kernels can parse events and tags, but Rust tokenizer, local
  token query planner, and Leptos Search parity remain open.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md` marks Rust search and
  tag lookup modules as missing.

## Target Behavior

Rust storage owns token row codecs, tag lookup command metadata, indexed local
query commands, and delete/update commands for cached event changes. Product
search never falls back to full cached-event scans for normal local search.
NIP-50 merge state stays in app and relay runtime modules, not storage.

## Docs To Update First

- `docs/product/tools/search.md` if visible behavior changes.
- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/parity-ledger.md` when search status changes.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/search.rs` when added.
- `crates/lkjstr-storage/src/commands/search.rs`.
- `crates/lkjstr-storage/src/events.rs` for tag lookup linkage when needed.
- `crates/lkjstr-web/src/sqlite_store/events.rs` as the first bridge, or a new
  `search.rs` adapter when repository calls exist.
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
