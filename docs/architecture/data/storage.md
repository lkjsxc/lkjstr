# Storage

## Purpose

Storage docs define browser persistence ownership.

## Stores

- `workspaces`: workspace layout and tab state.
- `accounts`: account metadata.
- `localAccountSecrets`: raw local signing account secret keys.
- `notifications`: local activity records.
- `tweetDrafts`: durable Tweet drafts.
- `events`: cached Nostr events.
- `eventRelays`: event relay receipts.
- `eventTags`: searchable `e`, `p`, `q`, and `a` tag rows.
- `eventPriority`: compaction score and byte-accounting rows for cached
  events. This is the current cache ledger pattern and should become the shared
  ledger for future local blobs such as image cache rows.
- `feedCursors`: feed paging cursors.
- `feedCoverage`: durable relay/filter/range coverage evidence and unresolved
  diagnostics for feed scans.
- `feedScanHints`: bounded performance hints for future grouped feed scan
  window sizes. Hints are separate from coverage proof.
- `jobs`: persisted in-app job records.
- `cacheMeta`: cache status records.
- `tabStates`: durable tab snapshot payloads keyed by `workspaceId + tabId`.
  `lastPaneId` is placement metadata only. See [Tab Snapshots](#tab-snapshots).
- `settings`: settings overrides.
- `relaySets`: editable relay sets.
- `relayDiagnosticSummaries`: persisted relay diagnostic summaries.
- `relayInformation`: fetched NIP-11 relay information documents.
- `relayListSuggestions`: per-account NIP-65 relay list suggestions.

## Contract

Local signing secrets are stored in dedicated IndexedDB tables separate from
public account records. Raw local accounts use the local secret table. Account
listing APIs return public account metadata only. NIP-07 signing stays in the
browser signer boundary.

Passkey-protected local secret storage is not implemented. The security design
is documented separately before any passkey secret table is restored.

## Feed Scan Hints

`feedScanHints` rows tune future relay windows without proving cache coverage:

| Row field | Meaning |
| --- | --- |
| `id` | durable key for the scan, relay, group, filter, and direction |
| `scanKey` | semantic feed scan key |
| `relayUrl` | relay the feedback came from |
| `groupKey` | route group identity |
| `filterKey` | semantic filter identity |
| `direction` | older, newer, or initial scan direction |
| `recommendedSpanSeconds` | next bounded span recommendation |
| `lastFeedback` | last sparse, balanced, dense, or incomplete signal |
| `updatedAt` | last write timestamp |

Hints are performance records, not absence proof. They are clamped to `1`
second through `180` days, ignored after `30` days, and compacted to the newest
`2000` rows. Hint cleanup must not delete events, accounts, workspace state,
settings, relays, drafts, or notifications.

## Tab Snapshots

`tabStates` rows store JSON payloads captured when a tab loses focus, moves,
reloads, or closes:

| Row field | Meaning |
| --- | --- |
| `id` | `${workspaceId}:${tabId}` durable key |
| `workspaceId`, `tabId` | Ownership identity |
| `lastPaneId` | Last known placement, not identity |
| `state` | Compact tab-kind payload |
| `updatedAt` | Last capture timestamp |

Session-memory snapshots mirror the same shape for fast restore within
`tabs.inactiveRetentionSeconds`. IndexedDB snapshots survive reload and expired
session TTL. Older pane-keyed rows are ignored and deleted during workspace
cleanup.

Payloads may include scroll anchors, cursors, flags, cheap tool fields, and up to
`200` event or notification ids. They must not include full events, profiles,
relay diagnostics, active workers, subscriptions, or unbounded arrays.

## Cleanup

Event-cache budget cleanup may prune cached events, event relay receipts, event
tag rows, feed cursors, and feed coverage affected by pruned feed keys.
Complete coverage rows compact sooner than dense, incomplete, unresolved, or
failed diagnostic rows. Cleanup must not prune accounts, local signing secrets,
settings, relay sets, workspace layout, notifications, Tweet drafts, relay
configuration, or tab snapshots. `tabStates` cleanup is owned by the workspace
snapshot coordinator and removes rows only for tabs absent from the workspace or
stale pre-tab-owned rows.

`feedScanHints` cleanup keeps newest useful hints, deletes stale rows, and
enforces the documented row cap. Hint compaction never invalidates coverage
because hints are not proof.

Compaction invalidates coverage for affected feed keys because complete coverage
is useful only while the local event repository can still prove the visible
range.

## Storage Inventory

Stats estimates IndexedDB table bytes by reading each table and encoding rows
as JSON. These values are diagnostic estimates, not browser quota truth.

The browser storage estimate remains authoritative for total site usage. The
difference between browser usage and table estimates is reported as storage
overhead or unknown usage. That gap can include IndexedDB indexes, browser
record overhead, localStorage, Cache Storage, and other origin-managed bytes.

Inventory rows are grouped as protected user data, prunable event cache,
derived cache, diagnostics, and storage overhead. This explains why the event
allowance can shrink while the visible event-cache byte estimate looks small.

Future local image or media caches must not create an independent quota system.
They should store their bytes in IndexedDB and register a row in the shared
cache ledger with a numeric score, byte estimate, protection flag, owner kind,
and updated timestamp so one compaction policy can evict the least important
local cached resource first.

## Event Cache Byte Accounting

`eventPriority` stores enough accounting for budget enforcement to avoid a full
`events` table scan on every pass:

| Row field | Meaning |
| --- | --- |
| `id` | event id |
| `ownerKind` | current owner category, initially `event` |
| `resourceKind` | cache resource category, initially `nostr-event` |
| `score` | durable eviction score |
| `createdAt` | event time for score ties |
| `protected` | explicit product-owned protection flag |
| `cacheBytes` | deterministic estimate for event-cache rows owned by the event |
| `updatedAt` | last score or byte-accounting update |

`cacheBytes` counts the normalized event row, relay receipt rows, searchable tag
rows, and priority row for the same event. Feed cursors and coverage are pruned
when affected events disappear, but they are not included in the first
event-owned byte estimate unless directly attributable.
