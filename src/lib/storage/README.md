# Storage

## Purpose

This directory contains browser-owned storage repositories, inventory helpers,
retention policy, and SQLite worker host glue.

## Table of Contents

- `old-indexed-db-diagnostics.ts`: presence-only diagnostics for old databases.
- `schema/`: logical table manifest and inventory groups.
- `ledger/`: cache ledger resource manifest and dispatch helpers.
- `operation/`: typed storage results, deadlines, and operation tracking.
- `repositories/`: feature-facing storage access wrappers.
- `retention/`: cache-pressure protection and retention policy helpers.
- `sqlite-opfs/`: official SQLite WASM worker client and worker core.
- `storage-inventory.ts`: SQLite-first Stats inventory composition.

## Contract

Durable storage work targets worker-owned SQLite. Feature code calls repository
functions and does not open IndexedDB, SQLite, or OPFS directly.
