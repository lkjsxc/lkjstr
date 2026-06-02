# Storage Repositories

## Purpose

This directory owns feature-facing access to browser-owned storage records.
Feature modules call these functions instead of reaching into database bindings.

## Table of Contents

- `accounts-store.ts`: account records.
- `secrets-store.ts`: local account signing secrets.
- `settings-store.ts`: flat setting overrides through SQLite worker storage.
- `tweet-drafts-store.ts`: protected Tweet drafts.
- `workspace-store.ts`: durable workspace layout through SQLite worker storage.
- `relay-sets-store.ts`: relay set configuration.
- `route-blocks-store.ts`: protected relay route blocks.
- `tab-states-store.ts`: tab snapshot rows and ledger records.
- `action-state-store.ts`: cached reaction/repost action lookup.
- `event-matching-store.ts`: filter matching over stored events.
- `event-query-store.ts`: indexed feed and tag reads over stored events.
- `events-store.ts`: event rows, relay receipts, tag rows, event ledger rows,
  and feed cursor ledger writes.
- `notifications-store.ts`: notification rows and notification ledger rows.
- `jobs-store.ts`: job rows and job ledger rows.
- `relay-diagnostics-store.ts`: relay diagnostic summaries and ledger rows.
- `relay-information-store.ts`: NIP-11 relay information and ledger rows.
- `relay-list-suggestions-store.ts`: NIP-65 relay suggestions and ledger rows.
- `author-relay-routes-store.ts`: protocol-derived author routes and ledger
  rows.
- `feed-coverage-store.ts`: feed coverage rows and their cache ledger entries.
- `feed-scan-hints-store.ts`: feed scan hint rows and their cache ledger
  entries.

## Contract

Repositories preserve safe edge behavior: reads use bounded fallbacks, writes
remain best-effort at the feature edge, and protected data is never connected to
cache compaction.
