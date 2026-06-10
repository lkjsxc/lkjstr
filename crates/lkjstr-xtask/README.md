# lkjstr Xtask

## Purpose

This crate owns Rust repository checks and quiet command orchestration.

## Table of Contents

- [src/](src/): xtask source.

## Ownership Index

- Owned meaning: documentation checks, line caps, Rust style scans, storage
  manifest checks, SQLite schema doc checks, and quiet gate orchestration.
- Forbidden meaning: product behavior, browser adapters, UI rendering, relay
  sockets, and storage row policy beyond repository validation.
- Effect boundary: runs local commands and reports bounded output; it does not
  implement product features.
- Main tests: `cargo test -p lkjstr-xtask` plus direct command runs.
- Next cutover task: keep ledgers enforced through existing docs and line checks
  before adding custom rules.

## Commands

- `check-docs`: strict documentation shape, table readability, recursive README
  coverage, and docs topology.
- `check-lines`: documentation and source line caps.
- `check-rust-style`: production Rust panic, placeholder, and global state scan.
- `check-storage-manifest-docs`: storage manifest docs comparison.
- `quiet rust-wasm`: Rust, WASM browser, and Trunk local matrix.
- `quiet verify`: repository checks, Rust/WASM matrix, and product verification.
- `quiet ci`: full local gate.
