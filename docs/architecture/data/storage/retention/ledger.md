# Cache Ledger

## Purpose

The cache ledger is the shared byte-accounting and deletion queue for every
recoverable browser-local resource.

## Record Fields

| Field | Meaning |
| --- | --- |
| `id` | stable ledger id |
| `ownerKind` | owner category |
| `resourceKind` | deletion category |
| `resourceId` | primary key in the owning store |
| `score` | eviction priority; lower deletes first |
| `createdAt` | resource time for tie breaks |
| `updatedAt` | last score or byte-accounting update |
| `cacheBytes` | deterministic owned-row estimate |
| `protected` | durable hard-protection flag |
| `accountPubkey` | optional account owner |
| `feedKey` | optional feed owner |
| `relayUrl` | optional relay owner |
| `reason` | short diagnostic reason |

## Resource Contract

Every ledger-backed resource provides:

```text
createLedgerRecord(resource)
estimateResourceBytes(resource, ownedRows)
targetExists(record)
deleteResource(record)
repairFromResourceRows()
dynamicProtectionKeys(activeRuntimeState)
```

## Resource Kinds

`nostr-event`, `notification-record`, `feed-cursor`, `coverage-row`,
`scan-hint`, `tab-state`, `relay-summary`, `relay-info`,
`relay-read-observation`, `relay-read-score`, `relay-list-suggestion`,
`author-relay-route`, `route-evidence-score`, and `job-record` each appear
exactly once in the ledger manifest.

## Rule

No table-specific quota policy may bypass the ledger. Future media or image
caches must use the same ledger contract instead of creating an independent
eviction system.
