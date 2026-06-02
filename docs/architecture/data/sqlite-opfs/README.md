# SQLite OPFS Storage

## Purpose

This subtree defines the worker-owned SQLite WASM storage target for
browser-owned data.

## Table of Contents

- [runtime.md](runtime.md): worker runtime, VFS order, and multi-tab behavior.
- [storage-modes.md](storage-modes.md): persistent OPFS and temporary memory modes.
- [schema.md](schema.md): canonical SQLite table groups, indexes, and owners.
- [worker-protocol.md](worker-protocol.md): typed request and response protocol.
- [query-ownership.md](query-ownership.md): SQL-owned reads and memory-only state.
- [repositories.md](repositories.md): repository boundary and SQL access rules.
- [migration-map.md](migration-map.md): current storage family to SQLite table map.
- [retention.md](retention.md): cache ledger, compaction, and quota behavior.
- [failure-recovery.md](failure-recovery.md): startup, busy, corrupt, and reset recovery.
- [import-export.md](import-export.md): explicit user-driven import and export.

## Storage Target

The durable browser store is official SQLite WASM in a worker. OPFS persistence
is the normal path, and temporary memory mode is explicit when persistence is
unavailable.

Product code calls typed repositories. The worker owns SQLite and OPFS access.
Main-thread code does not open SQLite, OPFS, or raw SQL. The normal host path
uses `opfs-sahpool` so storage does not require app-wide cross-origin isolation.

## Current Transition State

IndexedDB and Dexie remain only because the shipped SvelteKit runtime still uses
some repositories. Rust and TypeScript host code already include schema records,
statement records, row codecs, worker envelopes, and repository foundations.
Product startup, settings, accounts, relay sets, drafts, event graph writes,
cached feed reads, tag lookups, local filter search, relay diagnostics, relay
information, relay suggestions, author routes, route blocks, notifications,
feed coverage, scan hints, and jobs use the SQLite path. Retention, inventory,
cache metadata, and cache tools must move before Dexie is deleted.
