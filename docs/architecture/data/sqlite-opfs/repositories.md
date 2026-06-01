# SQLite OPFS Repositories

## Purpose

This file defines how Rust code may access SQLite. Status: partial
implementation.

## Ownership

`lkjstr-storage` owns repository traits, SQL statement records, row codecs,
typed outcomes, data class mapping, ledger records, and retention rules.

`lkjstr-app` composes repositories into startup, feed, publish, diagnostics,
and retention flows. Product crates and UI components do not call raw SQL.

`lkjstr-web` transports storage requests to the worker and maps browser failures
into storage outcomes. It does not contain product query rules.

Implemented now: protected row codecs and protected SQL statement records live
in `lkjstr-storage`; `lkjstr-web` has worker-backed repository calls for
settings, workspaces, tab states with ledger rows, accounts, local secrets,
relay sets, and Tweet drafts. Product startup and UI paths still use IndexedDB
or Dexie until the SQLite path is wired and tested as the durable product path.

## Repository Families

- protected data: settings, workspaces, tab states, accounts, secrets, relay
  sets, and Tweet drafts are partially implemented. Route blocks remain open.
- event cache: events, tags, relay provenance, notifications, feed cursors,
  feed coverage, and scan hints.
- relay diagnostics: relay information, summaries, suggestions, author routes,
  jobs, and app log records.
- retention: cache ledger, dynamic protection, compaction, repair, and
  inventory snapshots.

## Statement Shape

Every SQL statement record declares:

- stable statement id.
- SQL text.
- parameter shape.
- row shape or affected-row expectation.
- data class and table ownership.
- whether the statement must run inside a batch.

Ad hoc SQL strings outside `lkjstr-storage` are not allowed.

## Batch Shape

Ledger-backed resource writes use one transaction batch for resource rows and
the matching `cache_ledger` row. A resource write followed later by a separate
ledger update is not an acceptable steady state.

Batch steps must be bounded and ordered. Failure rolls back the whole batch and
returns the mapped storage outcome.

## Result Shape

Repositories return typed records and a `StorageOutcome`. Corrupt or missing
recoverable cache rows may degrade the product path; protected data failures
must remain visible to startup, Settings, Accounts, Stats, and lkjstr Log.
