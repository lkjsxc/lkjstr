# Storage Verification

## Purpose

Storage verification lists checks required for changes that affect durable
browser data, retention, feed evidence, or diagnostics.

## Unit Checks

- manifest includes all live protected and recoverable tables;
- docs table matches manifest;
- no live table reports `unknown` inventory group;
- SQLite physical inventory reports table counts without old row scans;
- old IndexedDB diagnostics report database presence only;
- compactable resources have ledger, bytes, target, delete, and repair paths;
- protected rows are skipped by selection;
- repair inserts missing rows and updates stale byte estimates;
- repair skips unavailable targets;
- inventory reports timeout or unavailable state explicitly;
- storage reads and writes report typed failures;
- event writes store event, receipts, tags, and ledger atomically;
- event compaction invalidates coverage conservatively.

## Host And Smoke Checks

- storage worker opens persistent OPFS or explicit temporary-memory mode;
- Welcome workspace recovery works after storage failure;
- Stats shows storage degraded state;
- storage pressure prunes recoverable cache;
- storage pressure preserves accounts, secrets, settings, relays, drafts, and
  workspaces;
- route blocks survive compaction;
- cache-first feeds do not trust compacted coverage.

## Commands

Run focused unit tests first, then repository checks, quiet verification, memory
cleanup tests when retention or runtime state changes, and Docker Compose final
gates for complete storage changes.
