# Storage

## Purpose

This directory contains browser-owned storage repositories, inventory helpers,
retention policy, and SQLite worker host glue.

## Table of Contents

- `browser-db.ts`: deletion-only Dexie binding until the SQLite cutover removes
  it.
- `old-indexed-db-diagnostics.ts`: presence-only diagnostics for old databases.
- `schema/`: table manifest and remaining IndexedDB store shape.
- `ledger/`: cache ledger resource manifest and dispatch helpers.
- `operation/`: typed storage results, deadlines, tracking, and transactions.
- `repositories/`: feature-facing storage access wrappers.
- `retention/`: cache-pressure protection and retention policy helpers.
- `sqlite-opfs/`: official SQLite WASM worker client and worker core.
- `storage-inventory.ts`: SQLite-first Stats inventory composition.

## Contract

New durable storage work targets worker-owned SQLite. Feature code calls
repository functions and does not choose Dexie tables, open IndexedDB, open
SQLite, or touch OPFS directly.
