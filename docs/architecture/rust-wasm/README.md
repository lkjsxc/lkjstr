# Rust WASM Architecture

## Purpose

This subtree defines the Rust/WASM client target.

## Table of Contents

- [app-boundary.md](app-boundary.md): app composition and command ownership.
- [crate-boundaries.md](crate-boundaries.md): crate responsibilities.
- [cutover/README.md](cutover/README.md): build cutover, parity, and deletion ledgers.
- [cutover/build-contract.md](cutover/build-contract.md): app build cutover.
- [cutover/parity-ledger.md](cutover/parity-ledger.md): product surface parity.
- [cutover/deletion-ledger.md](cutover/deletion-ledger.md): removal guard.
- [host-boundary.md](host-boundary.md): browser API and JavaScript boundary.
- [memory-ownership.md](memory-ownership.md): resources and cleanup.
- [protocol-kernel.md](protocol-kernel.md): Nostr protocol ownership.
- [relay-runtime.md](relay-runtime.md): relay state machines and adapters.
- [source-map.md](source-map.md): intended repository paths.
- [status.md](status.md): current implemented Rust slices and open foundations.
- [storage-kernel.md](storage-kernel.md): manifest, repositories, and OPFS SQLite.
- [surface-cutover-order.md](surface-cutover-order.md): dependency-ranked product cutover order.
- [ui-runtime.md](ui-runtime.md): Leptos UI ownership.
- [verification.md](verification.md): Rust/WASM verification matrix.

## Status

- Current product runtime: browser-first SvelteKit and TypeScript documented in
  [../README.md](../README.md). It remains the reference surface until each
  Rust replacement is real, tested, and recorded in
  [cutover/parity-ledger.md](cutover/parity-ledger.md).
- Current Rust/WASM state: partial and actively implemented. The detailed slice
  map lives in [status.md](status.md).
- Open Rust/WASM work: SQLite product repository wiring, retention and repair,
  product wiring from relay reducers to WebSocket and timer adapters, feed/tool
  runtimes, publish jobs, media upload transport, full Stats diagnostics, and
  UI parity.
- Not allowed: remote app backend, relay proxy requirement, server account
  system, fake relay data, fake protocol results, or placeholder UI.

## Ownership Summary

Rust owns the application contract. JavaScript remains only for browser host
bootstrap, focused tests, Wrangler, and narrow APIs that the browser exposes as
JavaScript objects.

The first implementation slices must be pure and testable: protocol parsing,
event identity, filter matching, relay message encoding, storage manifest
records, and workspace reducers. Browser effects are added only behind explicit
host adapters with cleanup handles.

The build cutover rule, surface ledger, and deletion ledger live under
[cutover/README.md](cutover/README.md).
