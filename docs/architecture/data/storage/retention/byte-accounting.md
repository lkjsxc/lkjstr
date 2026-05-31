# Byte Accounting

## Purpose

Byte accounting gives retention and Stats deterministic estimates without
pretending to replace browser quota measurements.

## Rules

- Browser `navigator.storage.estimate()` is the source for total origin usage.
- Table estimates are diagnostic JSON-encoding estimates.
- Ledger `cacheBytes` counts directly owned resource rows.
- Unknown browser overhead is reported separately.
- Zero or missing `cacheBytes` is a repair target.

## Resource Estimates

Event bytes include the normalized event row, relay receipt rows, searchable
tag rows, and the event ledger row draft.

Notification bytes include the notification row and ledger row draft.

Feed cursor, coverage, and scan hint bytes include the resource row and ledger
row draft.

Diagnostics bytes include the diagnostic or route-evidence row and ledger row
draft.

Tab-state bytes include the stale snapshot row and ledger row draft when the row
is ledger-backed.

## Stats Rule

Stats compares browser usage with known IndexedDB table estimates, ledger
estimates, localStorage bytes, Cache Storage bytes, and overhead. It must not
hide pressure only because ledger-estimated bytes are below the target.
