# lkjstr Protocol

## Purpose

This crate owns Rust Nostr protocol behavior shared by the WASM client and
native tests.

## Table of Contents

- [src/](src/): protocol source.
- [tests/](tests/): protocol tests.
- [examples/](examples/): local browser smoke fixtures and verification.

## Ownership Index

- Owned meaning: Nostr events, filters, messages, signatures, relay URLs, NIP
  helpers, upload auth helpers, and protocol-safe validation.
- Forbidden meaning: browser APIs, UI state, SQLite repositories, WebSocket
  handles, relay scheduling, and app surface policy.
- Effect boundary: pure Rust only; browser signing, fetch, storage, and sockets
  enter through higher crates.
- Main tests: `cargo test -p lkjstr-protocol`.
- Browser smoke support: `browser-fixtures` signs synthetic relay events and
  verifies browser publications; it emits public data only.
