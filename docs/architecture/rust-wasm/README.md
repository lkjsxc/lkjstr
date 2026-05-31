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
  byte, event, event-ID, filter, relay-message, signing, verification, NIP-19,
  relay URL, NIP-30 custom emoji, NIP-36 content-warning, tag indexing,
  reaction parsing, action tag builder, content-derived tag, NIP-51 emoji
  source, NIP-57 zap, NIP-65 relay-list metadata, NIP-96 upload metadata, and
  NIP-98 HTTP auth behavior. `lkjstr-web` exposes the implemented protocol
  bridge through browser-tested WASM exports.
  `lkjstr-domain` owns pure account records, local secret row shape, local
  signing helpers, and npub mining prefix rules. `lkjstr-storage` owns the
  executable storage table manifest, ledger resource map, and typed storage
  operation outcomes.
- Design-only target: remaining Rust relay, app, UI, storage repositories,
  IndexedDB adapter, and non-protocol browser host surfaces.
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
