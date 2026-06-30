# SQLite OPFS Storage

## Purpose

This subtree defines the worker-owned SQLite WASM storage target for
browser-owned data.

## Table of Contents

- [runtime.md](runtime.md): worker runtime, VFS order, and multi-tab behavior.
- [owner-lifecycle.md](owner-lifecycle.md): logical owner lifecycle and close rules.
- [app-broker.md](app-broker.md): app-wide broker shared by TypeScript and Rust/WASM callers.
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

The shipped SvelteKit runtime uses typed SQLite repositories for durable product
storage. Rust and TypeScript host code include schema records, statement
records, row codecs, worker envelopes, and repository foundations. Product
startup, settings, tab snapshots, accounts, relay sets, drafts, event graph
writes, cached feed reads, tag lookups, local filter search, relay diagnostics,
relay information, relay suggestions, author routes, route blocks,
notifications, feed coverage, scan hints, cache ledger summaries, cache
metadata, retention protection, retention deletion, repair, physical inventory,
cache tools, app-log rows, and jobs use the SQLite path.
