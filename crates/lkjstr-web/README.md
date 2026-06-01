# lkjstr Web

## Purpose

This crate owns Rust/WASM browser exports and host adapters.

## Table of Contents

- [src/](src/): WASM exports and bridge helpers.
- [tests/](tests/): browser-bound WASM tests.

## Status

The current implementation exposes real Rust protocol functions to JavaScript
and mounts the partial Rust Leptos workspace shell. IndexedDB host adapters now
cover protected workspace, settings, account, local secret, relay-set, Tweet
draft, and ledger-backed tab-state rows. A typed SQLite storage-worker adapter
exists as host glue for the OPFS target, and protected SQLite repository calls
now run over that adapter. Relay, feed, and full tool adapters remain
documented targets until their source and tests exist.
