# lkjstr-host

## Purpose

Serve the verified static Nostr browser application without a Node server.
This native crate is separate from the Rust/WASM browser migration.

## Table of Contents

- [Cargo.toml](Cargo.toml): native runtime and test dependencies.
- [src/](src/): asset validation, HTTP service and command-line entry.
- [tests/](tests/): native HTTP and invalid-deployment regression tests.

## Contract

The process never owns accounts, signing keys, user storage or relay connections.
The existing edge owns HTTPS. Do not add blanket COOP/COEP headers or a successful
HTML fallback for missing JavaScript or WASM files.

See [self-hosting](../../docs/operations/self-hosting.md) for build, container,
private GitOps boundaries and verification commands.
