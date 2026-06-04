# SQLite OPFS Storage

## Purpose

This decision records the durable browser storage target for lkjstr.

## Decision

Browser-owned durable data uses official SQLite WASM opened in a worker and
persisted with OPFS when available.

The normal product mode is persistent OPFS SQLite. If OPFS cannot open, the app
may start in explicit temporary memory mode so the Welcome workspace remains
usable. Temporary mode is not durable and must be visible to the user.

## Rationale

SQLite gives the app one normalized local data graph for:

- Nostr events, tags, relay provenance, and feed coverage.
- Timeline, profile, thread, notification, search, and relay-route queries.
- Protected user records such as accounts, settings, drafts, workspace layout,
  and relay sets.
- Cache ledger, diagnostics, inventory, integrity checks, and compaction.

SQL indexes let the storage kernel answer bounded pages without scanning large
JavaScript arrays. Normalized relay provenance also lets the app preserve where
events came from without duplicating event payloads.

## Storage Modes

- Persistent OPFS: official SQLite WASM uses OPFS from a worker. This is the
  normal durable path.
- Temporary memory: official SQLite WASM uses `:memory:` after persistent open
  fails or when a test explicitly forces it. The UI must warn that changes may
  disappear when the browser session ends.

Do not use IndexedDB as a new fallback durable store.

## Boundaries

- No backend storage service is introduced.
- Main-thread code does not open SQLite or OPFS.
- Product code does not send raw SQL.
- Typed repositories own product commands and SQL statement selection.
- The worker owns SQLite initialization, VFS selection, schema changes,
  transactions, bounded queries, diagnostics, reset, and close.

## Non Goals

- Preserving old browser database behavior as a permanent path.
- Adding a server account system, relay proxy, or cloud sync service.
- Hiding temporary memory mode from the user.
- Storing decrypted private messages in general search by default.

## Consequences

The storage cutover is allowed to break old local data. Every moved data family
must update docs, tests, repository functions, Stats diagnostics, and failure
recovery in the same coherent change.
