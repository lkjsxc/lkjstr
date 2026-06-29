# SQLite OPFS

## Purpose

This directory contains browser host glue for the worker-owned SQLite WASM
storage target.

## Table of Contents

- `types.ts`: worker protocol value types.
- `database.ts`: SQL execution helpers and SQLite module types.
- `open-database.ts`: VFS selection and database opening.
- `worker-core.ts`: request handling independent of worker globals.
- `worker-health.ts`: storage health projection.
- `physical-inventory.ts`: worker-side bounded table inventory.
- `physical-inventory-repository.ts`: Stats-facing inventory rows.
- `event-schema.ts`: event graph, relay receipt, tag, cursor, and ledger schema.
- `event-row-codec.ts`: stored-event row decoding helpers.
- `events-sqlite.ts`: event and feed cursor writes plus direct event lookups.
- `notifications-sqlite.ts`: notification rows and notification ledger writes.
- `feed-cache-steps.ts`: feed coverage and scan hint SQL write/delete steps.
- `feed-cache-sqlite.ts`: feed coverage and scan hint repositories.
- `event-pages-sqlite.ts`: timeline, profile, thread, and tag cache reads.
- `event-matching-sqlite.ts`: Nostr filter candidate reads for cache search.
- `sqlite-record-helpers.ts`: JSON record table helpers.
- `cache-ledger-sqlite.ts`: cache ledger reads and cache metadata writes.
- `cache-compaction-sqlite.ts`: retention deletion for ledger resources.
- `app-log-repository.ts`: redacted durable app-log append, list, and clear.
- `cache-ledger-repair-*.ts`: chunked cache-ledger health and repair.
- `test-api.ts`: localhost-only storage API bridge for focused tests.
- `relay-cache-schema.ts`: relay diagnostics, route, job, and ledger schema.
- `relay-cache-steps.ts`: relay cache SQL write steps.
- `relay-cache-sqlite.ts`: relay diagnostics, NIP-11, suggestions, routes, and blocks.
- `jobs-sqlite.ts`: durable job repository calls.
- `worker.ts`: dedicated module worker entry point.
- `client.ts`: browser client with deadlines, cancellation, and cleanup.
- `owner-coordination.ts`: BroadcastChannel holder hints for owner-busy UI.
- `kernel-client.ts`: shared open/apply/send helper for product repositories.
- `accounts-sqlite.ts`: account and local secret repositories.
- `storage-health.ts`: Stats-facing health reader for the SQLite worker.
- `settings-sqlite.ts`: flat setting override repository.
- `workspace-sqlite.ts`: workspace layout repository.
- `relay-sets-sqlite.ts`: relay set repository.
- `tweet-drafts-sqlite.ts`: Tweet draft repository.
- `tab-states-sqlite.ts`: tab snapshot repository.

## Contract

The worker may load official SQLite WASM and execute storage-owned statements.
Product modules must call typed repositories instead of formatting SQL. New code
uses factories and plain data only.
