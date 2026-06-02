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
- `event-schema.ts`: SQLite event graph, relay receipt, tag, cursor, and ledger schema.
- `event-row-codec.ts`: stored-event row decoding helpers.
- `events-sqlite.ts`: event and feed cursor writes plus direct event lookups.
- `event-pages-sqlite.ts`: timeline, profile, thread, and tag cache reads.
- `event-matching-sqlite.ts`: Nostr filter candidate reads for local cache search.
- `sqlite-record-helpers.ts`: JSON record table helpers shared by SQLite repositories.
- `relay-cache-schema.ts`: relay diagnostics, route, job, and ledger schema.
- `relay-cache-steps.ts`: relay cache SQL write steps.
- `relay-cache-sqlite.ts`: relay diagnostics, NIP-11, suggestions, routes, and blocks.
- `jobs-sqlite.ts`: durable job repository calls.
- `worker.ts`: dedicated module worker entry point.
- `client.ts`: browser client with deadlines, cancellation, and cleanup.
- `kernel-client.ts`: shared open/apply/send helper for product repositories.
- `accounts-sqlite.ts`: SQLite-backed account and local secret repositories.
- `storage-health.ts`: Stats-facing health reader for the SQLite worker.
- `settings-sqlite.ts`: SQLite-backed flat setting override repository.
- `workspace-sqlite.ts`: SQLite-backed workspace layout repository.
- `relay-sets-sqlite.ts`: SQLite-backed relay set repository.
- `tweet-drafts-sqlite.ts`: SQLite-backed Tweet draft repository.

## Contract

The worker may load official SQLite WASM and execute storage-owned statements.
Product modules must call typed repositories instead of formatting SQL. New code
uses factories and plain data only.
