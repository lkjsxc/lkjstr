# Rust WASM Architecture

## Purpose

This subtree defines the Rust/WASM client target.

## Table of Contents

- [app-boundary.md](app-boundary.md): app composition and command ownership.
- [crate-boundaries.md](crate-boundaries.md): crate responsibilities.
- [host-boundary.md](host-boundary.md): browser API and JavaScript boundary.
- [memory-ownership.md](memory-ownership.md): resources and cleanup.
- [protocol-kernel.md](protocol-kernel.md): Nostr protocol ownership.
- [relay-runtime.md](relay-runtime.md): relay state machines and adapters.
- [source-map.md](source-map.md): intended repository paths.
- [storage-kernel.md](storage-kernel.md): manifest, repositories, and IDB.
- [ui-runtime.md](ui-runtime.md): Leptos UI ownership.
- [verification.md](verification.md): Rust/WASM verification matrix.

## Status

- Implemented today: browser-first SvelteKit and TypeScript runtime documented
  in [../README.md](../README.md), plus Rust workspace checks and Rust protocol
  byte, event, event-ID, filter, relay-message, signing, and verification
  behavior.
- Design-only target: remaining Rust relay, storage, app, UI, and WASM browser
  surfaces.
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
