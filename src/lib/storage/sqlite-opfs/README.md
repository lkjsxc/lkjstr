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
- `worker.ts`: dedicated module worker entry point.
- `client.ts`: browser client with deadlines, cancellation, and cleanup.
- `kernel-client.ts`: shared open/apply/send helper for product repositories.
- `storage-health.ts`: Stats-facing health reader for the SQLite worker.
- `settings-sqlite.ts`: SQLite-backed flat setting override repository.
- `workspace-sqlite.ts`: SQLite-backed workspace layout repository.
- `tweet-drafts-sqlite.ts`: SQLite-backed Tweet draft repository.

## Contract

The worker may load official SQLite WASM and execute storage-owned statements.
Product modules must call typed repositories instead of formatting SQL. New code
uses factories and plain data only.
