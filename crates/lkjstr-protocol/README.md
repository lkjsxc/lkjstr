# lkjstr Protocol

## Purpose

This crate owns Rust Nostr protocol behavior as it moves out of the current
browser runtime.

## Table of Contents

- [src/](src/): protocol source.
- [tests/](tests/): protocol tests.

## Ownership Index

- Owned meaning: Nostr events, filters, messages, signatures, relay URLs, NIP
  helpers, upload auth helpers, and protocol-safe validation.
- Forbidden meaning: browser APIs, UI state, SQLite repositories, WebSocket
  handles, relay scheduling, and app surface policy.
- Effect boundary: pure Rust only; browser signing, fetch, storage, and sockets
  enter through higher crates.
- Main tests: `cargo test -p lkjstr-protocol`.
- Next cutover task: expose remaining TypeScript protocol callers through real
  Rust or WASM bridge functions before deletion proof.
