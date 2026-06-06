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

Implemented now: protected and core event-cache row codecs plus SQL statement
records live in `lkjstr-storage`; `lkjstr-web` has worker-backed repository
calls for settings, workspaces, tab states with ledger rows, accounts, local
secrets, relay sets, Tweet drafts, events, tags, relay provenance,
notifications, feed cursors, feed coverage, scan hints, relay diagnostics,
relay information, relay suggestions, author routes, route blocks, jobs, app
log rows, and SQLite table-count inventory. The active Rust product wiring
slice routes startup, workspace persistence, Accounts, Relay Settings, Upload
Settings, Tweet drafts, and Stats through these calls. The Svelte product path
continues to use the TypeScript SQLite worker repositories until each surface
has Leptos parity and deletion proof.

## Repository Families

- protected data: settings, workspaces, tab states, accounts, secrets, relay
  sets, Tweet drafts, and route blocks have Rust SQLite worker calls. Startup
  and Rust tool hosts must use these calls before Leptos parity expands.
- event cache: events, tags, relay provenance, feed cursors, cached feed pages,
  tag lookups, local filter search, notifications, feed coverage, and scan hints
  have SQLite repositories. Feed surfaces may render cached rows only when
  coverage proof is complete.
- relay diagnostics: relay information, summaries, suggestions, author routes,
  route blocks, jobs, and app log rows have SQLite repositories. Relay
  diagnostics, suggestions, routes, finished jobs, and app logs are
  ledger-backed. Route blocks are protected safety rows and are not ledger-backed.
- retention: cache ledger rows, protection snapshots, prune selection,
  deletion dispatch, repair, and physical inventory are SQLite-backed. SQLite
  inventory uses storage-owned count statements for known schema tables; host
  code must not format table names itself.

## Remaining Cutover Tasks

- Cache maintenance: manual cleanup, compaction, and reset actions stay bounded
  and report typed outcomes.
- Rust feed parity: feed runtimes consume event cache, feed evidence,
  diagnostics, and retention repositories through `lkjstr-app`.
- Removal proof: TypeScript repositories stay until Rust covers every live table
  family, tests pass, and no-import proof is recorded.

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
