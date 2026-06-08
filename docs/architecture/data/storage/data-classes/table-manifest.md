# Table Manifest

## Purpose

This table is the LLM-readable view of the executable Storage Manifest. The
manifest source owns the data; repository checks keep this Markdown table
aligned with it.

## Live Tables

| Table | Class | Group | Ledger resource | Owner |
| --- | --- | --- | --- | --- |
| `workspaces` | `protected-user-data` | `protected` | none | workspace |
| `accounts` | `protected-user-data` | `protected` | none | accounts |
| `localAccountSecrets` | `protected-user-data` | `protected` | none | signer |
| `notifications` | `recoverable-cache` | `prunable-cache` | `notification-record` | notifications |
| `tweetDrafts` | `protected-user-data` | `protected` | none | Tweet |
| `events` | `recoverable-cache` | `prunable-cache` | `nostr-event` | events |
| `cacheLedger` | `ledger` | `ledger` | none | storage |
| `eventRelays` | `recoverable-cache` | `prunable-cache` | parent `nostr-event` | events |
| `eventTags` | `recoverable-cache` | `prunable-cache` | parent `nostr-event` | events |
| `feedCursors` | `derived-feed-cache` | `derived-page-cache` | `feed-cursor` | feeds |
| `feedCoverage` | `derived-feed-cache` | `derived-page-cache` | `coverage-row` | feeds |
| `feedScanHints` | `derived-feed-cache` | `derived-page-cache` | `scan-hint` | feeds |
| `jobs` | `recoverable-cache` | `prunable-cache` | `job-record` | jobs |
| `cacheMeta` | `metadata` | `metadata` | none | storage |
| `tabStates` | `protected-user-data` | `protected` | `tab-state` for stale absent rows | workspace |
| `settings` | `protected-user-data` | `protected` | none | settings |
| `relaySets` | `protected-user-data` | `protected` | none | relays |
| `relayDiagnosticSummaries` | `diagnostics-cache` | `diagnostics` | `relay-summary` | relays |
| `relayInformation` | `diagnostics-cache` | `diagnostics` | `relay-info` | relays |
| `relayListSuggestions` | `diagnostics-cache` | `diagnostics` | `relay-list-suggestion` | relays |
| `authorRelayRoutes` | `diagnostics-cache` | `diagnostics` | `author-relay-route` | relays |
| `relayRouteBlocks` | `protected-safety-configuration` | `protected-safety` | none | relays |

## Row-Level Notes

`eventRelays` and `eventTags` are owned rows for the `nostr-event` resource.
They do not get independent eviction.

`tabStates` is a protected table because active snapshots recover the
workspace. Stale snapshots for tabs absent from the current workspace may be
ledger-backed and compacted through the `tab-state` dispatcher.

`jobs` is compactable for finished jobs. Pending and running jobs are protected
by dynamic protection.

The active-account selector is stored as a protected `settings` row so account
selection, read-only state, local signer state, and NIP-07 availability do not
use localStorage as product storage.
