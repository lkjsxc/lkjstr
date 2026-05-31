# Repositories

## Purpose

Storage repositories isolate feature modules from Dexie. They keep table access,
transactions, normalization, operation results, and ledger writes in one
storage-owned subsystem.

## Boundary

Direct `browserDb()` access is allowed only in:

- `src/lib/storage/browser-db.ts`
- `src/lib/storage/schema/`
- `src/lib/storage/operation/`
- `src/lib/storage/repositories/`
- `src/lib/storage/ledger/`
- `src/lib/storage/retention/`
- `src/lib/storage/inventory/`
- storage-internal tests

Feature modules call repository functions for accounts, secrets, settings,
relay sets, workspaces, events, notifications, feed pages, jobs, relay
diagnostics, and tab states.

## Repository Rules

- Reads normalize optional persisted fields before returning rows.
- Writes return typed storage results.
- Ledger-backed writes include the resource and ledger row in one transaction.
- Protected writes do not silently downgrade durability.
- Cache writes may continue the UI on failure while recording diagnostics.
- Repository tests cover storage-unavailable behavior.

## Event Repository

Event writes normalize the event, merge relay provenance, create relay receipt
rows, create searchable tag rows, and write the event ledger row atomically.
Memory write may happen first for responsive UI, but callers must distinguish
session-visible data from durable storage success.
