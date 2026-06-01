# Source Map

## Purpose

This file maps the intended Rust/WASM repository layout. Status: partially
implemented for the Rust workspace, protocol crate, web bridge crate, partial
UI shell, and repository checks.

## Root Paths

- `Cargo.toml`: Rust workspace plus the thin Trunk build package that points at
  the `lkjstr-web` entry source.
- `Cargo.lock`: locked Rust dependency graph.
- `rust-toolchain.toml`: Rust toolchain channel and WASM target.
- `.cargo/`: cargo configuration and linker flags.
- `_headers`: Cloudflare COOP/COEP headers for SQLite WASM OPFS support.
- `crates/`: Rust application crates.
- `index.html`: Trunk browser entry document.
- `static/`: images, manifest files, and split CSS assets.
- `src/lib/storage/sqlite-opfs/`: temporary TypeScript host worker and client
  for official SQLite WASM while the Rust adapter lands.
- `tests/`: Playwright and WASM browser tests.
- `tools/`: repository tooling that is not part of product runtime.
- `package.json`: minimal Node tooling for Playwright, Wrangler, wrappers, and
  the official SQLite WASM worker package.

## Crate Paths

- `crates/lkjstr-protocol/`: protocol kernel.
- `crates/lkjstr-domain/`: pure domain reducers and models.
- `crates/lkjstr-relays/`: relay state machines and schedulers.
- `crates/lkjstr-storage/`: manifest, repositories, ledger, and retention.
- `crates/lkjstr-app/`: product runtime composition.
- `crates/lkjstr-ui/`: Leptos components and UI CSS contracts.
- `crates/lkjstr-web/`: WASM entrypoint and browser host adapters.
- `crates/lkjstr-web/src/sqlite_store/`: protected SQLite repository calls.
- `crates/lkjstr-web/src/storage_worker/`: typed SQLite worker host adapter.
- `crates/lkjstr-xtask/`: repository checks and quiet gates.

## Transition Rule

TypeScript and Svelte product code may remain only while it is the implemented
surface. After a Rust/WASM surface passes equivalent tests, the matching
TypeScript or Svelte product code is removed in the same coherent slice.
