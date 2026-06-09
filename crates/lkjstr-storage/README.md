# lkjstr Storage

## Purpose

This crate owns Rust storage contracts for the worker-owned SQLite OPFS target.

## Table of Contents

- [src/](src/): storage manifest, ledger, row codecs, commands, and outcomes.
- [tests/](tests/): storage contract tests.

## Ownership Index

- Owned meaning: table manifest, schema records, row codecs, repository command
  types, operation outcomes, retention, repair, inventory, pressure, and Stats
  storage projections.
- Forbidden meaning: Svelte state, browser globals, OPFS handles, WebSocket
  handles, NIP-07 prompts, and product UI copy.
- Effect boundary: pure storage policy and codecs only; `lkjstr-web` executes
  worker messages and browser quota calls.
- Main tests: `cargo test -p lkjstr-storage` and
  `cargo run -p lkjstr-xtask -- check-storage-manifest-docs`.
- Next cutover task: add typed repository commands for feed event cache,
  coverage, retention dispatch, and repair.
