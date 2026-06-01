# SQLite OPFS Storage

## Purpose

This subtree defines the OPFS-backed SQLite WASM storage target for browser
owned data. Status: design target with executable Rust schema work next.

## Table of Contents

- [runtime.md](runtime.md): worker runtime, VFS choice, headers, and
  multi-tab behavior.
- [schema.md](schema.md): canonical SQLite table groups and constraints.
- [repositories.md](repositories.md): Rust repository ownership and SQL access
  rules.
- [retention.md](retention.md): cache ledger, protected data, compaction, and
  quota behavior.
- [worker-protocol.md](worker-protocol.md): typed request and response protocol.
- [import-export.md](import-export.md): explicit user-driven import and export.

## Storage Target

The durable browser store is SQLite WASM in a dedicated worker, using OPFS as
the primary persistence layer. Rust owns schema records, statement records,
repository contracts, data classes, retention rules, and typed outcomes.

JavaScript owns only the host worker transport and the official SQLite WASM
asset loading needed by the browser. Product logic, reducers, protocol parsing,
relay orchestration, and storage rules do not live in the worker script.

## Current Transition State

IndexedDB and Dexie remain only because the shipped SvelteKit runtime still
uses them. New storage architecture and Rust/WASM implementation work should
target this subtree. Delete Dexie paths only after matching Rust/SQLite
repositories, browser behavior, tests, and cutover ledger evidence exist.

