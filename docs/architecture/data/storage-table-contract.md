# Storage Table Contract

## Purpose

This file is the LLM-readable table map for durable browser storage. It mirrors
the live Dexie schema and keeps each store tied to retention, Stats, deletion,
and repair behavior.

## Rule

Every live Dexie table must appear here, in [storage.md](storage.md), and in
`knownStorageTables`. No live table may report the `unknown` inventory group.

For every prunable table, the same change must provide a ledger writer,
deterministic byte estimate, delete dispatcher, inventory group,
repair/backfill behavior, and tests.

## Table Matrix

| Store | Class | Ledger resource | Stats group | Delete path | Repair path |
| --- | --- | --- | --- | --- | --- |
| `workspaces` | protected user data | none | `protected` | workspace owner only | none |
| `accounts` | protected user data | none | `protected` | account owner only | none |
| `localAccountSecrets` | protected user data | none | `protected` | secret owner only | none |
| `notifications` | prunable cache | `notification-record` | `prunable-cache` | cache dispatcher | backfill from rows |
| `tweetDrafts` | protected user data | none | `protected` | draft owner only | none |
| `events` | prunable cache | `nostr-event` | `prunable-cache` | event dispatcher | backfill with receipts and tags |
| `cacheLedger` | ledger | none | `ledger` | target deletion or repair | orphan delete and row repair |
| `eventRelays` | prunable event-owned cache | parent `nostr-event` | `prunable-cache` | event dispatcher | rebuilt with event row |
| `eventTags` | prunable event-owned cache | parent `nostr-event` | `prunable-cache` | event dispatcher | rebuilt with event row |
| `feedCursors` | derived page cache | `feed-cursor` | `derived-page-cache` | cache dispatcher | backfill from rows |
| `feedCoverage` | derived page cache | `coverage-row` | `derived-page-cache` | cache dispatcher | backfill from rows |
| `feedScanHints` | derived page cache | `scan-hint` | `derived-page-cache` | cache dispatcher | backfill from rows |
| `jobs` | active jobs protected; finished jobs prunable | `job-record` | `prunable-cache` | cache dispatcher | backfill from rows |
| `cacheMeta` | metadata | none | `metadata` | overwritten by status writes | none |
| `tabStates` | active snapshots protected; stale absent snapshots prunable | `tab-state` | `protected` | workspace owner or cache dispatcher | backfill from rows |
| `settings` | protected user data | none | `protected` | settings owner only | none |
| `relaySets` | protected user data | none | `protected` | relay-settings owner only | none |
| `relayDiagnosticSummaries` | diagnostics cache | `relay-summary` | `diagnostics` | cache dispatcher | backfill from rows |
| `relayInformation` | diagnostics cache | `relay-info` | `diagnostics` | cache dispatcher | backfill from rows |
| `relayListSuggestions` | diagnostics cache | `relay-list-suggestion` | `diagnostics` | cache dispatcher | backfill from rows |
| `authorRelayRoutes` | diagnostics cache | `author-relay-route` | `diagnostics` | cache dispatcher | backfill from rows |
| `relayRouteBlocks` | protected safety/configuration | none | `protected-safety` | route-block owner only | none |

## Pressure Interpretation

When browser usage is above `cache.maxBytes`, any eligible prunable ledger row
may be compacted regardless of which table owns it. When no eligible row
remains, Stats must explain the remaining pressure as protected data,
unknown/browser overhead, incomplete inventory, unavailable quota, or
unsupported storage APIs.

`relayRouteBlocks` is intentionally outside the ledger. A route block suppresses
unsafe or user-blocked route use, so pressure reports it as protected safety
data instead of recoverable diagnostics.
