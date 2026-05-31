# Storage

## Purpose

Storage docs define browser persistence ownership.

The compact table-to-retention matrix for agent work lives in
[storage-table-contract.md](storage-table-contract.md). Keep that file, this
file, the Dexie schema, and `knownStorageTables` aligned.

## Stores

| Store | Classification | Retention |
| --- | --- | --- |
| `workspaces` | protected user data | never cache-compacted |
| `accounts` | protected user data | never cache-compacted |
| `localAccountSecrets` | protected user data | never cache-compacted |
| `notifications` | prunable cache | ledger-backed; recent, unread, visible, and account-window rows are dynamically protected |
| `tweetDrafts` | protected user data | never cache-compacted |
| `events` | prunable cache | ledger-backed cached Nostr event resource |
| `cacheLedger` | ledger | ledger rows are removed with their target resource or by repair |
| `eventRelays` | prunable cache | owned by the event ledger resource |
| `eventTags` | prunable cache | owned by the event ledger resource |
| `feedCursors` | derived page cache | ledger-backed feed cursor resource |
| `feedCoverage` | derived page cache | ledger-backed coverage row resource |
| `feedScanHints` | derived page cache | ledger-backed scan hint resource |
| `jobs` | prunable cache | active jobs are protected; finished jobs are ledger-backed |
| `cacheMeta` | metadata | diagnostic metadata, replaced by status writes |
| `tabStates` | protected user data | active workspace snapshots are protected; absent stale tabs may become ledger-backed cache |
| `settings` | protected user data | never cache-compacted |
| `relaySets` | protected user data | never cache-compacted |
| `relayDiagnosticSummaries` | diagnostics cache | ledger-backed relay summary resource |
| `relayInformation` | diagnostics cache | ledger-backed NIP-11 resource |
| `relayListSuggestions` | diagnostics cache | ledger-backed relay suggestion resource |
| `authorRelayRoutes` | diagnostics cache | ledger-backed author route evidence |
| `relayRouteBlocks` | protected safety/configuration | bounded route suppression records; never cache-compacted |

No current store may classify as `unknown`. A new store that is not documented
with a classification is a repository invariant failure.

When the IndexedDB store shape changes, the Dexie schema step must advance in
the same change. Reusing a previous schema step can leave existing browser
profiles without newly documented object stores, so diagnostics must still
treat missing stores as unavailable and never use that failure as proof that
protected data is safe to delete.

## Route Blocks

`relayRouteBlocks` rows suppress relay routes for a purpose after user,
runtime, or safety decisions. They are protected safety/configuration rows, not
recoverable route evidence. They stay outside `cacheLedger`, diagnostics
cleanup, and route-evidence pruning.

The in-memory route-block map is bounded, but durable rows stay until their
owner clears the block. Cache pressure reports their bytes as protected safety
pressure instead of deleting them.

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

Each `tabStates` write registers a `tab-state` ledger row. Normal workspace
cleanup deletes absent snapshots and their ledger rows immediately. If an
absent snapshot survives because cleanup did not run, cache compaction may
delete it through the `tab-state` dispatcher. Ledger repair backfills missing
tab-state rows from the current table and removes orphan tab-state ledger rows.

Payloads may include scroll anchors, cursors, flags, cheap tool fields, and up to
`200` event or notification ids. They must not include full events, profiles,
relay diagnostics, active workers, subscriptions, or unbounded arrays.

## Cleanup

Local-cache budget cleanup may prune any `cacheLedger` resource that is not
durably or dynamically protected. Event cleanup removes cached events, relay
receipts, tag rows, and coverage affected by deleted event data. Notification
cleanup removes only notification rows. Feed/page cleanup removes cursors,
coverage rows, and scan hints without deleting events. Diagnostics cleanup
removes recoverable relay summaries, relay information, suggestions, author
route evidence, and finished jobs without deleting user relay configuration or
route-block safety rows.

Cleanup must not prune accounts, local signing secrets, settings, relay sets,
workspace layout, Tweet drafts, active tab snapshots, active jobs, or user-owned
relay configuration. `tabStates` cleanup is owned by the workspace snapshot
coordinator and removes rows only for tabs absent from the workspace or stale
pre-tab-owned rows.

`feedScanHints` cleanup keeps newest useful hints, deletes stale rows, and
enforces the documented row cap. Hint compaction never invalidates coverage
because hints are not proof.

Compaction invalidates coverage for affected feed keys because complete coverage
is useful only while the local event repository can still prove the visible
range.

## Storage Inventory

Stats estimates IndexedDB table bytes by reading each table and encoding rows
as JSON. These values are diagnostic estimates, not browser quota truth.
Inventory status must be explicit: `exact`, `timeout`, `unavailable`, or
`unsupported`. Timed-out scans keep their partial byte count and must not be
reported as zero-byte success.

The browser storage estimate remains authoritative for total site usage. The
difference between browser usage, known IndexedDB table estimates,
localStorage bytes, and Cache Storage bytes is reported as storage overhead or
unknown usage. That gap can include IndexedDB indexes, browser record overhead,
unregistered origin data, and unsupported measurement paths.

Inventory rows are grouped as protected user data, protected safety/config,
prunable cache, derived page cache, diagnostics, ledger, metadata, non-IndexedDB
storage, storage overhead, and unknown. This explains whether pressure comes
from events, notifications, page rows, diagnostics, protected rows, Cache
Storage, localStorage, or unknown browser overhead.

Future local image or media caches must not create an independent quota system.
They should store their bytes in IndexedDB and register a row in the shared
cache ledger with a numeric score, byte estimate, protection flag, owner kind,
and updated timestamp so one compaction policy can evict the least important
local cached resource first.

## Cache Ledger Byte Accounting

`cacheLedger` stores enough accounting for budget enforcement to avoid full
resource table scans on every pass:

| Row field | Meaning |
| --- | --- |
| `id` | stable ledger id |
| `ownerKind` | owning cache category |
| `resourceKind` | deletion category |
| `resourceId` | primary key in the owning resource store |
| `score` | durable eviction score |
| `createdAt` | resource time for score ties |
| `protected` | explicit product-owned protection flag |
| `cacheBytes` | deterministic estimate for resource-owned rows |
| `updatedAt` | last score or byte-accounting update |
| `accountPubkey` | optional account owner |
| `feedKey` | optional feed owner |
| `relayUrl` | optional relay owner |
| `reason` | optional diagnostic score or protection reason |

`cacheBytes` counts the directly owned row set. For cached Nostr events it
counts the normalized event row, relay receipt rows, searchable tag rows, and
ledger row for the same event. For notification and page resources it counts
the resource row and ledger row. Shared overhead is reported separately as
unknown or browser overhead when the browser estimate is larger than table
estimates.
