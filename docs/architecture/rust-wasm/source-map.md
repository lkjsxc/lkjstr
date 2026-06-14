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
- `static/`: images, manifest files, split CSS assets, and
  `sqlite-opfs-worker.js`.
- `node_modules/@sqlite.org/sqlite-wasm/dist/`: pinned official SQLite WASM
  assets copied to `/sqlite/` by Trunk and emitted by the SvelteKit build while
  both runtimes exist.
- `src/lib/storage/sqlite-opfs/`: temporary TypeScript host worker and client
  for official SQLite WASM while the Rust adapter lands.
- `tests/`: focused tests and WASM browser tests.
- `tools/`: repository tooling that is not part of product runtime.
- `package.json`: minimal Node tooling for focused tests, Wrangler, wrappers, and
  the official SQLite WASM worker package.

## Crate Paths

- `crates/lkjstr-protocol/`: protocol kernel.
- `crates/lkjstr-domain/`: pure domain reducers and models.
- `crates/lkjstr-relays/`: relay state machines and schedulers.
- `crates/lkjstr-relays/src/client/`: pure relay client lifecycle reducer,
  events, effects, and state.
- `crates/lkjstr-relays/src/request_budget/`: pure request-budget derivation,
  filter clamping, relay-limit diagnostics, and read-cap merge policy.
- `crates/lkjstr-relays/src/page_read/`: semantic page-read key derivation,
  in-flight read registry state, progressive read snapshot reduction, and event
  provenance merge policy.
- `crates/lkjstr-relays/src/demand/`: pure demand records, lease fingerprint
  derivation, and owner visibility registry state.
- `crates/lkjstr-relays/src/route_plan/`: pure selected fallback, targeted route
  grouping, disabled-relay filtering, and score ordering.
- `crates/lkjstr-relays/src/ingress.rs`: pure render-critical event-kind
  ingress policy.
- `crates/lkjstr-relays/src/live_lease/`: pure live lease attach, detach,
  visibility, ingress counters, and host-effect decisions.
- `crates/lkjstr-storage/`: manifest, repositories, ledger, and retention.
- `crates/lkjstr-app/`: product runtime composition.
- `crates/lkjstr-app/src/feed/`: pure feed runtime identity, live lease
  composition, surface query input builders, feed-window reduction, cursor
  derivation, generation guards, and terminal empty-state readiness.
- `crates/lkjstr-app/src/custom_request/`: Custom Request parser, policy
  clamps, exact/adaptive mode classification, and run planning.
- `crates/lkjstr-app/src/query/`: pure app-level query demand planning.
- `crates/lkjstr-ui/`: Leptos components, Custom Request planning form, and
  UI CSS contracts.
- `crates/lkjstr-web/`: WASM entrypoint and browser host adapters.
- `crates/lkjstr-web/src/custom_request_host.rs`: worker-backed relay-settings
  provider for Custom Request run planning.
- `crates/lkjstr-web/src/relay_host/`: relay WebSocket and browser timeout
  host adapters with owned callback cleanup.
- `crates/lkjstr-web/src/sqlite_host_store.rs`: scoped open, close, and
  typed error propagation for SQLite worker-backed Rust hosts.
- `crates/lkjstr-web/src/sqlite_store/`: protected, cache, diagnostics, jobs,
  route-block, and app-log SQLite repository calls.
- `crates/lkjstr-web/src/workspace_host.rs`: SQLite-backed Rust workspace
  startup and persistence.
- `crates/lkjstr-web/src/storage_worker/`: typed SQLite worker host adapter.
- `crates/lkjstr-xtask/`: repository checks and quiet gates.

## Transition Rule

TypeScript and Svelte product code may remain only while it is the implemented
surface. After a Rust/WASM surface passes equivalent tests, the matching
TypeScript or Svelte product code is removed in the same coherent slice.
