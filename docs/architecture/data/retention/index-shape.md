# Retention Index Shape

## Purpose

Retention index shape defines how cache priority and byte accounting are stored
and queried.

## Store

- IndexedDB object store `cacheLedger`.
- Primary key: ledger id.
- Indexes:
  - `ownerKind`: owner diagnostics and bounded rebuilds.
  - `resourceKind`: resource diagnostics and targeted selectors.
  - `resourceId`: owning row lookup.
  - `score`: ascending candidate queries.
  - `createdAt`: tie-break and diagnostics.
  - `updatedAt`: stale diagnostics.
  - `protected`: durable hard-protection filtering.
  - `accountPubkey`, `feedKey`, `relayUrl`: owner-scoped diagnostics.
  - `[protected+score]`, `[ownerKind+score]`, `[resourceKind+score]`: cheap
    candidate and inventory reads.

## Record Fields

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `id` | string | Stable ledger id, normally `${ownerKind}:${resourceId}` |
| `ownerKind` | string | Owning cache class such as `event`, `notification`, or `feed-page` |
| `resourceKind` | string | Deletion shape such as `nostr-event`, `notification-record`, or `feed-cursor` |
| `resourceId` | string | Primary key in the owning resource store |
| `score` | number | Current retention score; lower deletes first |
| `createdAt` | number | Resource creation time for tie-break |
| `updatedAt` | number | Last score or byte-accounting update |
| `cacheBytes` | number | Deterministic byte estimate for the resource and owned rows |
| `protected` | boolean | Durable hard-protected flag when true |
| `accountPubkey` | string? | Account owner for notification and account-scoped cache |
| `feedKey` | string? | Feed owner for page cache |
| `relayUrl` | string? | Relay owner for diagnostics and protocol cache |
| `reason` | string? | Short diagnostic reason for the current score or protection |

## Owner Kinds

- `event`
- `notification`
- `feed-page`
- `feed-coverage`
- `feed-scan-hint`
- `tab-snapshot`
- `relay-diagnostic`
- `relay-information`
- `relay-suggestion`
- `route-evidence`
- `job`

## Resource Kinds

- `nostr-event`
- `notification-record`
- `feed-cursor`
- `coverage-row`
- `scan-hint`
- `tab-state`
- `relay-summary`
- `relay-info`
- `relay-list-suggestion`
- `author-relay-route`
- `job-record`

## Update Path

- Every writer of prunable local data either upserts a `cacheLedger` row in the
  same logical operation or documents why the data is protected.
- Event ingest and relationship index writers upsert event ledger rows and
  target bumps.
- Notification, feed page, diagnostics, relay protocol cache, route evidence,
  finished job, and tab snapshot writers upsert their own ledger rows. Active
  tab-state rows are dynamically protected; absent stale rows may be compacted.
- Compaction reads ascending `score` in batches until the site storage target is
  met or no prunable candidates remain.
- Durable protected rows and dynamically protected ids are skipped during
  eviction selection.

## Schema Revision

- Opening the database at the current schema revision owns a `cacheLedger`
  store. Old event-only priority rows are not a separate retention system.
- Bounded rebuild work may populate missing ledger rows from current cache
  tables. Normal compaction does not depend on full resource table scans.
- Removed settings keys `cache.maxEvents`, `cache.maxAgeDays`, and
  `cache.compactionEnabled` are ignored.
