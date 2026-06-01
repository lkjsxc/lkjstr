# Rust WASM Architecture

## Purpose

This subtree defines the Rust/WASM client target.

## Table of Contents

- [app-boundary.md](app-boundary.md): app composition and command ownership.
- [crate-boundaries.md](crate-boundaries.md): crate responsibilities.
- [cutover/README.md](cutover/README.md): build cutover, parity, and deletion ledgers.
- [host-boundary.md](host-boundary.md): browser API and JavaScript boundary.
- [memory-ownership.md](memory-ownership.md): resources and cleanup.
- [protocol-kernel.md](protocol-kernel.md): Nostr protocol ownership.
- [relay-runtime.md](relay-runtime.md): relay state machines and adapters.
- [source-map.md](source-map.md): intended repository paths.
- [storage-kernel.md](storage-kernel.md): manifest, repositories, and IDB.
- [ui-runtime.md](ui-runtime.md): Leptos UI ownership.
- [verification.md](verification.md): Rust/WASM verification matrix.

## Status

- Current product runtime: browser-first SvelteKit and TypeScript documented in
  [../README.md](../README.md). It remains the reference surface until each
  Rust replacement is real, tested, and recorded in
  [cutover/parity-ledger.md](cutover/parity-ledger.md).
- Current Rust/WASM state: partial and actively implemented. Rust owns protocol
  parsing, event identity, signing helpers, NIP entity codecs, relay URL
  normalization, pure workspace/account/relay-set/draft models, storage
  manifest and outcome contracts, narrow IndexedDB adapters, relay state
  machine basics, startup composition, and a partial Leptos shell.
- Open Rust/WASM work: full relay client reducer, WebSocket and timer adapters,
  complete storage repositories and transactions, feed/tool runtimes, publish
  jobs, media upload transport, full Stats diagnostics, and UI parity.
- Not allowed: remote app backend, relay proxy requirement, server account
  system, fake relay data, fake protocol results, or placeholder UI.

## Ownership Summary

Rust owns the application contract. JavaScript remains only for browser host
bootstrap, Playwright, Wrangler, and narrow APIs that the browser exposes as
JavaScript objects.

The first implementation slices must be pure and testable: protocol parsing,
event identity, filter matching, relay message encoding, storage manifest
records, and workspace reducers. Browser effects are added only behind explicit
host adapters with cleanup handles.

The build cutover rule, surface ledger, and deletion ledger live under
[cutover/README.md](cutover/README.md).
