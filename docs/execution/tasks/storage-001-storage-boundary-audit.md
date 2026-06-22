# STORAGE-001 Storage Boundary Audit

## Purpose

Confirm product modules use typed repositories instead of direct browser storage APIs.

## Status

implemented

## Current Evidence

- `checkStorageBoundary` rejects raw browser storage outside approved paths.
- SQLite OPFS imports are now limited to approved adapters, repositories, diagnostics, cache maintenance, and root host lifecycle.
- The boundary search found no unclassified product violations after the guard update.

## Next Edit

Preserve the allowlist when storage ownership moves, and remove carveouts only after replacement repositories exist.

## Files To Read

- docs/architecture/data/storage/README.md
- docs/architecture/data/sqlite-opfs/README.md
- docs/architecture/source-map.md
- scripts/repo-storage-boundary.ts

## Files To Touch

- scripts/repo-storage-boundary.ts
- tests/unit/repo-storage-boundary.test.ts
- docs/architecture/data/storage/\*\*

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
