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
  write, delete, repair, inventory, or retention path still needs SQLite wiring.
- `open` means only the contract exists.

## Protected Data

| Current family | SQLite table group | Status | Notes |
| --- | --- | --- | --- |
| `workspaces` | `workspaces` | implemented | Startup recovery keeps memory fallback. |
| `tabStates` | `tab_states` | implemented | Svelte tab snapshots and cleanup use the worker. |
| `settings` | `settings` | implemented | Flat key-value overrides use the worker. |
| `accounts` | `accounts` | implemented | Account rows use the worker; passkey protection is a follow-up. |
| `localAccountSecrets` | `local_account_secrets` | implemented | Current local secret contract only; no passkey claim. |
| `relaySets` | `relay_sets` | implemented | User and discovery relay sets use the worker. |
| `tweetDrafts` | `tweet_drafts` | implemented | Compose drafts use the worker. |
| `relayRouteBlocks` | `relay_route_blocks` | implemented | Protected safety rows use the worker. |

## Event And Feed Cache

| Current family | SQLite table group | Status | Notes |
| --- | --- | --- | --- |
| `events` | `events` | implemented | Product event writes and cached feed reads use the worker. |
| `eventRelays` | `event_relays` | implemented | Relay provenance upserts with the event transaction. |
| `eventTags` | `event_tags` | implemented | Thread, mention, and route lookups use SQL tag rows. |
| `notifications` | `notifications` | implemented | Materialized rows persist through SQLite and are derived from real stored events. |
| `feedCursors` | `feed_cursors` | implemented | Cursor writes follow successful SQLite cache page reads. |
| `feedCoverage` | `feed_coverage` | implemented | Coverage proves cache-first reads only when complete. |
| `feedScanHints` | `feed_scan_hints` | implemented | Warm scan hints persist in SQLite and never prove absence. |

## Jobs, Diagnostics, And Retention

| Current family | SQLite table group | Status | Deletion blocker | Notes |
| --- | --- | --- | --- | --- |
| `jobs` | `jobs` | implemented | none | Publish and maintenance job records use the worker. |
| `relayDiagnosticSummaries` | `relay_diagnostic_summaries` | implemented | none | Stats reads durable summaries through SQLite. |
| `relayInformation` | `relay_information` | implemented | none | NIP-11 records use SQLite product wiring. |
| `relayListSuggestions` | `relay_list_suggestions` | implemented | none | Suggestions remain explicit-import only. |
| `authorRelayRoutes` | `author_relay_routes` | implemented | none | Disabled relays and route blocks still dominate. |
| `cacheLedger` | `cache_ledger` | implemented | none | Resource writes, summaries, prune selection, event/direct retention deletion, health, and repair use SQLite. |
| `cacheMeta` | `cache_meta` | implemented | none | Cache status metadata and repair metadata use SQLite; cache tool summary gaps now come from physical inventory. |
| physical inventory | SQLite catalog and old-store diagnostics | implemented | none | `storage-inventory.ts` composes SQLite table counts, old IndexedDB database presence without row scans, localStorage, Cache Storage, and residual overhead. |
| app log | `app_log` | implemented | none | `src/lib/storage/sqlite-opfs/app-log-repository.ts` appends, lists, clears, and trims redacted rows; `src/lib/tabs/log/LkjstrLogTab.svelte` renders durable rows with session rows. |

## Deletion Criterion

Old browser database bindings are removed. New storage work stays on typed
SQLite repositories or explicit temporary memory mode.
