# Table Manifest

## Purpose

This table is the LLM-readable view of the executable Storage Manifest. The
manifest source owns the data; repository checks keep this Markdown table
aligned with it.

## Live Tables

| Table | Class | Group | Ledger resource | Owner | Command family | Retention behavior | Stats projection |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `workspaces` | `protected-user-data` | `protected` | none | workspace | `workspace` | `protected` | `row-count` |
| `accounts` | `protected-user-data` | `protected` | none | accounts | `accounts` | `protected` | `row-count` |
| `localAccountSecrets` | `protected-user-data` | `protected` | none | signer | `accounts` | `protected` | `row-count-redacted` |
| `notifications` | `recoverable-cache` | `prunable-cache` | `notification-record` | notifications | `notifications` | `ledger-prunable` | `row-count` |
| `tweetDrafts` | `protected-user-data` | `protected` | none | Tweet | `tweet-drafts` | `protected` | `row-count` |
| `events` | `recoverable-cache` | `prunable-cache` | `nostr-event` | events | `event-cache` | `ledger-prunable` | `row-count` |
| `cacheLedger` | `ledger` | `ledger` | none | storage | `retention-ledger` | `not-prunable-index` | `row-count` |
| `eventRelays` | `recoverable-cache` | `prunable-cache` | parent `nostr-event` | events | `event-cache` | `parent-ledger-prunable` | `row-count` |
| `eventTags` | `recoverable-cache` | `prunable-cache` | parent `nostr-event` | events | `event-cache` | `parent-ledger-prunable` | `row-count` |
| `feedCursors` | `derived-feed-cache` | `derived-page-cache` | `feed-cursor` | feeds | `feed-cache` | `ledger-prunable` | `row-count` |
| `feedCoverage` | `derived-feed-cache` | `derived-page-cache` | `coverage-row` | feeds | `feed-cache` | `ledger-prunable` | `coverage-status` |
| `feedScanHints` | `derived-feed-cache` | `derived-page-cache` | `scan-hint` | feeds | `feed-cache` | `ledger-prunable` | `row-count` |
| `jobs` | `recoverable-cache` | `prunable-cache` | `job-record` | jobs | `jobs` | `dynamic-protection` | `row-count` |
| `cacheMeta` | `metadata` | `metadata` | none | storage | `storage-diagnostics` | `metadata` | `pressure-health` |
| `tabStates` | `protected-user-data` | `protected` | `tab-state` for stale absent rows | workspace | `tab-states` | `active-protected-stale-prunable` | `row-count` |
| `settings` | `protected-user-data` | `protected` | none | settings | `settings` | `protected` | `row-count` |
| `relaySets` | `protected-user-data` | `protected` | none | relays | `relay-sets` | `protected` | `row-count` |
| `relayDiagnosticSummaries` | `diagnostics-cache` | `diagnostics` | `relay-summary` | relays | `relay-diagnostics` | `ledger-prunable` | `row-count` |
| `relayInformation` | `diagnostics-cache` | `diagnostics` | `relay-info` | relays | `relay-diagnostics` | `ledger-prunable` | `row-count` |
| `relayListSuggestions` | `diagnostics-cache` | `diagnostics` | `relay-list-suggestion` | relays | `relay-diagnostics` | `ledger-prunable` | `row-count` |
| `authorRelayRoutes` | `diagnostics-cache` | `diagnostics` | `author-relay-route` | relays | `relay-routes` | `ledger-prunable` | `row-count` |
| `relayRouteBlocks` | `protected-safety-configuration` | `protected-safety` | none | relays | `relay-routes` | `protected-safety` | `row-count` |

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

Pressure snapshots are stored in `cacheMeta`. Stats projects their exact stop
reason, protected bytes, prunable bytes, unknown bytes, and residual browser
overhead when a real snapshot exists; otherwise Stats renders an explicit
unavailable state.
