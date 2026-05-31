# Storage Verification

## Purpose

Storage verification lists the checks required for changes that affect durable
browser data, retention, feed evidence, or diagnostics.

## Unit Checks

- manifest includes all live tables
- docs table matches manifest
- Dexie schema is generated from manifest
- no live table reports `unknown`
- compactable resources have ledger, bytes, target, delete, and repair paths
- protected rows are skipped by selection
- repair inserts missing rows and updates stale byte estimates
- repair skips unavailable targets
- inventory reports timeout with partial bytes
- storage reads and writes report typed failures
- event writes store event, receipts, tags, and ledger atomically
- event compaction invalidates coverage conservatively

## Browser Checks

- clean startup when IndexedDB is unavailable
- Welcome workspace recovery after storage failure
- Stats shows storage degraded state
- storage pressure prunes recoverable cache
- storage pressure preserves accounts, secrets, settings, relays, drafts, workspaces
- route blocks survive compaction
- cache-first feeds do not trust compacted coverage

## Commands

Run focused unit tests first, then repository checks, quiet verification, memory
tests when retention or runtime state changes, and Docker Compose final gates
for complete storage changes.
