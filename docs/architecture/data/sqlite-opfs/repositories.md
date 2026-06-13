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

`pnpm check:repo` enforces the browser boundary: raw SQLite WASM imports and
OPFS open primitives stay in `src/lib/storage/sqlite-opfs/`, while raw browser
store access stays in storage-owned compatibility areas.

Implemented now: protected and core event-cache row codecs plus SQL statement
records live in `lkjstr-storage`; `lkjstr-web` has worker-backed repository
calls for settings, workspaces, tab states with ledger rows, accounts, local
secrets, relay sets, Tweet drafts, events, tags, relay provenance,
notifications, feed cursors, feed coverage, scan hints, relay diagnostics,
relay information, relay suggestions, author routes, route blocks, jobs, app
log rows, active-account selector rows, pressure snapshots, Search token rows,
SQLite table-count inventory, and SQLite worker health. Rust startup,
workspace persistence, Accounts, Relay Settings, Settings, Upload Settings,
Tweet drafts, Stats inventory, and Stats health route through these calls. The
Svelte product path continues to use the TypeScript SQLite worker repositories
until each surface has Leptos parity and deletion proof.

## Repository Families

- protected data: settings, workspaces, tab states, accounts, secrets, relay
  sets, Tweet drafts, and route blocks have Rust SQLite worker calls. Startup
  and Rust tool hosts use these calls before Leptos parity expands.
- event cache: events, tags, relay provenance, feed cursors, cached feed pages,
  tag lookup metadata, Search token rows, notifications, feed coverage, and scan
  hints have SQLite repositories. Feed surfaces may render cached rows only when
  coverage proof is complete.
- relay diagnostics: relay information, summaries, suggestions, author routes,
  route blocks, jobs, app log rows, pressure snapshots, active-account selector
  rows, and SQLite worker health have SQLite repositories or host calls. Relay diagnostics, suggestions, routes, finished
  jobs are ledger-backed. App log rows are bounded diagnostics rows in the
  current worker path and are not ledger-backed until a retention command adds a
  real ledger policy. Route blocks are protected safety rows and are not
  ledger-backed.
- retention: cache ledger rows, protection snapshots, prune selection,
  deletion dispatch, repair, and physical inventory are SQLite-backed. SQLite
  inventory uses storage-owned count statements for known schema tables; host
  code must not format table names itself.

## Remaining Cutover Tasks

- Cache maintenance: manual cleanup, compaction, and reset actions stay bounded
  and report typed outcomes.
- Local Search: app planner, NIP-50 merge, and UI parity remain open; shipped
  TypeScript Search storage stays active until parity proof.
- Rust feed parity: feed runtimes consume event cache, feed evidence,
  diagnostics, and retention repositories through `lkjstr-app`.
- Removal proof: TypeScript repositories stay until Rust covers every live table
  family, tests pass, and no-import proof is recorded.

## Command Metadata Contract

Every live worker repository command has storage-owned metadata. The metadata
names the command id, family, operation, input type, output type, statement ids,
tables, row codecs, problem kinds, data classes, ledger policy, protection
policy, and Stats projection. Batch commands list every statement they execute;
ledger-backed writes store resource rows and ledger rows in the same batch.
Inventory-only commands may omit manifest tables only when documented as
inventory-only.

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
