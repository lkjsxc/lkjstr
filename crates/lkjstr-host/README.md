# lkjstr-host

## Purpose

Serve the verified static Nostr browser application without a Node server.
This native crate is separate from the Rust/WASM browser migration.

## Ownership

- `src/assets.rs`: bounded startup checks for the immutable asset tree and WASM manifest.
- `src/lib.rs`: HTTP routes, file service, response policy, and headers.
- `src/main.rs`: serve/check/probe commands and graceful shutdown.
- `tests/`: native HTTP and invalid-deployment regression tests.

The process never owns accounts, signing keys, user storage, or relay connections.
The existing edge owns HTTPS. Do not add blanket COOP/COEP headers or a successful
HTML fallback for missing JS/WASM files.

See [self-hosting](../../docs/operations/self-hosting.md) for the build,
container, GitOps boundary, and verification commands.
