# IndexedDB Bridge

## Purpose

This directory contains the Rust browser host adapter for IndexedDB paths that
remain narrow WASM exports or host-boundary tests. Product startup and Rust tool
hosts use the SQLite worker adapter.

## Table of Contents

- `account_store.rs`: account table repository.
- `callbacks.rs`: owned request callback slots.
- `database.rs`: database open and object store helpers.
- `inventory_store.rs`: table-count inventory snapshot reads for narrow tests.
- `local_secret_store.rs`: local signing secret table repository.
- `mod.rs`: public IndexedDB module surface.
- `record_requests.rs`: shared request helpers for keyed records.
- `record_write.rs`: shared write helpers for keyed records.
- `relay_set_store.rs`: relay-set table repository.
- `schema.rs`: manifest-driven object store and index creation.
- `settings_requests.rs`: settings request execution and decoding.
- `settings_store.rs`: settings override row `put`, `get`, `delete`, and list.
- `transaction.rs`: multi-store write transactions.
- `transaction_events.rs`: owned transaction callbacks and deadline cleanup.
- `tweet_draft_store.rs`: protected Tweet draft table repository.
- `workspace_store.rs`: workspace `put`, `get`, and startup input helper for
  narrow exports.

The code here may call `web_sys` directly. Pure storage rules and row shapes
stay in `lkjstr-storage`.
