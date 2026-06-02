# Worker Owned Storage

## Purpose

This decision records where SQLite and OPFS access may occur.

## Decision

The database is opened only in a browser Worker context. The main thread talks
to storage through typed request and response messages.

The preferred ownership shape is one shared storage owner for the origin. When a
SharedWorker is unavailable, a dedicated Worker may run only with an explicit
single-owner strategy and visible diagnostics.

## Rationale

SQLite WASM OPFS persistence is worker-oriented, and OPFS APIs used by SQLite
are not a safe main-thread product dependency. One database owner also avoids
unplanned lock contention between tabs, panes, and background jobs.

Centralized ownership lets the app keep one place for:

- VFS selection and persistent open fallback.
- Schema change application.
- Prepared statement execution.
- Short write transactions and ingestion batches.
- Query cancellation and deadlines.
- Integrity checks, compaction, reset, and diagnostics.

## Main Thread Contract

The main thread may:

- create the storage client.
- generate request ids.
- pass typed commands.
- cancel requests.
- display storage mode, warnings, and health.
- recover to Welcome when storage is unavailable.

The main thread must not:

- import SQLite WASM directly for product storage.
- open OPFS directly.
- format ad hoc SQL.
- keep a second durable database handle.

## Worker Contract

The worker owns:

- official SQLite WASM initialization.
- OPFS and memory database opening.
- schema changes and statement execution.
- transaction boundaries.
- batched relay ingestion.
- storage health, integrity, reset, and close.

The worker uses factory functions and plain data. First-party source classes are
not part of the storage design.
