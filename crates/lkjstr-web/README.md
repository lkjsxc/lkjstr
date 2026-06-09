# lkjstr Web

## Purpose

This crate owns Rust/WASM browser exports and host adapters.

## Table of Contents

- [src/](src/): WASM exports and bridge helpers.
- [tests/](tests/): browser-bound WASM tests.

## Ownership Index

- Owned meaning: WASM entrypoint, browser worker messaging, WebSocket handles,
  timers, NIP-07 boundary calls, Web Crypto/WebAuthn boundaries, file picker,
  fetch adapters, and other browser-only effects.
- Forbidden meaning: pure domain decisions, protocol meaning, storage policy,
  relay budgets, feed policy, and product UI decisions.
- Effect boundary: executes typed commands from lower crates and maps browser
  failures to stable outcomes with explicit close and cleanup paths.
- Main tests: `cargo test -p lkjstr-web` and browser-backed WASM tests when Node
  cannot represent the platform API.
- Next cutover task: add the typed effect loop between Rust relay runtime and
  browser WebSocket handles.

## Status

The crate exposes real Rust protocol functions to JavaScript and mounts the
partial Leptos workspace shell. A typed SQLite storage-worker adapter exists for
OPFS product storage calls. Relay, feed, and full tool adapters remain targets
until their source and tests exist.
