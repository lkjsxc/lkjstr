# lkjstr Domain

## Purpose

This crate owns pure domain reducers and browser-independent application models.

## Table of Contents

- [src/](src/): domain source.
- [tests/](tests/): domain tests.

## Ownership Index

- Owned meaning: account records, relay-set records, workspace layout, tab
  state, clean startup state, public-chat reducers, and shared models.
- Forbidden meaning: browser effects, SQLite statements, WebSocket handles,
  timers, DOM state, and Svelte stores.
- Effect boundary: no host effects; callers provide inputs and execute returned
  decisions elsewhere.
- Main tests: `cargo test -p lkjstr-domain`.
- Next cutover task: move signer preconditions and account-state transitions
  out of TypeScript account modules.
