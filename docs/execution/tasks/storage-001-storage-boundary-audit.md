# STORAGE-001 Storage Boundary Audit

## Purpose

Confirm product modules use typed repositories instead of direct browser storage APIs.

## Status

ready

## Current Evidence

- `checkStorageBoundary` exists
- storage boundary docs require worker-owned SQLite OPFS

## Next Edit

Run the search, classify every hit, and tighten guardrails only for real violations.

## Files To Read

- docs/architecture/data/storage/README.md
- docs/architecture/data/sqlite-opfs/README.md
- docs/architecture/source-map.md
- scripts/repo-storage-boundary.ts

## Files To Touch

- scripts/repo-storage-boundary.ts
- tests/unit/repo-storage-boundary.test.ts
- docs/architecture/data/storage/**

## Focused Gate

```sh
rg "indexedDB|localStorage|caches|navigator.storage|sqlite|OPFS|openDatabase" src tests scripts crates
pnpm check:repo
```

## Acceptance

Every hit is classified as approved adapter, repository, diagnostic, test, script, crate, or violation.

## Must Not

- Do not move direct storage access into product code.
- Do not weaken existing storage guardrails.
