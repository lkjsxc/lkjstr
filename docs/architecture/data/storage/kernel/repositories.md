# Repositories

## Purpose

Storage repositories isolate feature modules from database bindings. They keep
storage commands, transactions, normalization, operation results, and ledger
writes in one storage-owned subsystem.

## Boundary

Feature modules call repository functions for accounts, secrets, settings, relay
sets, workspaces, drafts, events, notifications, feed pages, jobs, relay
diagnostics, and tab states.

Direct browser database access is not allowed in product modules.

SQLite repositories live under `src/lib/storage/sqlite-opfs/`. Product UI code
must not format SQL or open OPFS.

## Repository Rules

- Reads normalize optional persisted fields before returning rows.
- Writes return typed storage results or keep explicit memory fallback.
- Ledger-backed writes include the resource and ledger row in one transaction.
- Protected writes do not silently hide failed durability.
- Cache writes may continue the UI on failure while recording diagnostics.
- Repository tests cover storage-unavailable behavior.

## Event Repository

Event writes normalize the event, merge relay provenance, create relay receipt
rows, create searchable tag rows, and write the event ledger row atomically.
Memory write may happen first for responsive UI, but callers must distinguish
session-visible data from durable storage success.
