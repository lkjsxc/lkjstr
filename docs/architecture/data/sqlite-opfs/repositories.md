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
notifications, feed cursors, feed coverage, and scan hints. The Svelte Settings,
workspace, tab snapshot, Accounts, local secret, relay set, Tweet draft, event
graph, cached feed, tag lookup, local filter-search, relay diagnostics, relay
information, relay suggestion, author route, route block, notification, feed
coverage, scan hint, cache ledger summary, cache metadata, retention, and job
repositories now use the TypeScript SQLite worker path. Other Svelte product
paths use the SQLite worker for durable product storage. Remaining Rust work is
parity wiring and UI ownership.

## Repository Families

- protected data: settings, workspaces, tab states, accounts, secrets, relay
  sets, Tweet drafts, and route blocks are implemented in the Svelte SQLite
  path.
- event cache: events, tags, relay provenance, feed cursors, cached feed pages,
  tag lookups, local filter search, notifications, feed coverage, and scan hints
  are implemented in the Svelte SQLite path. Repair and compaction dispatch use
  SQLite repositories.
- relay diagnostics: relay information, summaries, suggestions, author routes,
  route blocks, and jobs are implemented in the Svelte SQLite path. App log rows
  remain open. Relay diagnostics, suggestions, routes, and finished jobs are
  ledger-backed. Route blocks are protected safety rows and are not ledger-backed.
- retention: cache ledger rows, protection snapshots, prune selection,
  deletion dispatch, repair, and physical inventory are SQLite-backed. SQLite
  inventory uses storage-owned count statements for known schema tables; host
  code must not format table names itself.

## Remaining Cutover Tasks

- Cache maintenance: manual cleanup, compaction, and reset actions stay bounded
  and report typed outcomes.
- Rust parity: Rust repositories cover every live table family before the
  TypeScript product surface can be removed.

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
