# SQLite Cutover Migration Map

## Purpose

This file maps current browser storage families to the target worker-owned
SQLite tables so agents can move one repository family at a time without losing
ownership context.

## Rules

- The left column names the current product storage family.
- The right column names the target SQLite table group.
- `implemented` means the shipped Svelte product path writes through the SQLite
  worker under normal browser startup.
- `partial` means schema or host calls exist but at least one product read,
  write, delete, repair, inventory, or retention path still depends on Dexie.
- `open` means only the contract exists.

## Protected Data

| Current family | SQLite table group | Status | Notes |
| --- | --- | --- | --- |
| `workspaces` | `workspaces` | implemented | Startup recovery keeps memory fallback. |
| `tabStates` | `tab_states` | partial | Rust adapter has rows; Svelte retention still needs full SQLite wiring. |
| `settings` | `settings` | implemented | Flat key-value overrides use the worker. |
| `accounts` | `accounts` | implemented | Account rows use the worker; passkey protection is a follow-up. |
| `localAccountSecrets` | `local_account_secrets` | implemented | Current local secret contract only; no passkey claim. |
| `relaySets` | `relay_sets` | implemented | User and discovery relay sets use the worker. |
| `tweetDrafts` | `tweet_drafts` | implemented | Compose drafts use the worker. |
| `relayRouteBlocks` | `relay_route_blocks` | partial | Protected safety rows need Svelte cutover. |

## Event And Feed Cache

| Current family | SQLite table group | Status | Notes |
| --- | --- | --- | --- |
| `events` | `events` | partial | Host schema exists; product feed reads still need durable SQLite queries. |
| `eventRelays` | `event_relays` | partial | Relay provenance must upsert in the same event transaction. |
| `eventTags` | `event_tags` | partial | Thread, mention, and route lookups must be SQL-owned. |
| `notifications` | `notifications` | partial | Materialized rows must be derived from real stored events. |
| `feedCursors` | `feed_cursors` | partial | Cursor writes must follow successful SQL page reads. |
| `feedCoverage` | `feed_coverage` | partial | Coverage proves cache-first reads only when complete. |
| `feedScanHints` | `feed_scan_hints` | partial | Hints never prove absence. |

## Jobs, Diagnostics, And Retention

| Current family | SQLite table group | Status | Notes |
| --- | --- | --- | --- |
| `jobs` | `jobs` | partial | Publish and maintenance jobs need Svelte cutover. |
| `relayDiagnosticSummaries` | `relay_diagnostic_summaries` | partial | Stats should read durable summaries through SQLite. |
| `relayInformation` | `relay_information` | partial | NIP-11 records need SQLite product wiring. |
| `relayListSuggestions` | `relay_list_suggestions` | partial | Suggestions remain explicit-import only. |
| `authorRelayRoutes` | `author_relay_routes` | partial | Disabled relays and route blocks still dominate. |
| `cacheLedger` | `cache_ledger` | partial | Ledger writes must be atomic with resource writes. |
| `cacheMeta` | `cache_meta` | partial | Pressure, repair, and integrity state move with retention. |
| app log | `app_log` | open | Durable redacted app log is a diagnostics target. |

## Deletion Criterion

Dexie can be removed only after every row above is implemented or explicitly
reclassified as memory-only or out of scope in the same docs and source change.
