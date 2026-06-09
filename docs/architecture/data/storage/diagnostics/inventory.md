# Storage Inventory

## Purpose

Inventory explains browser-owned storage for Stats, repair, and cache pressure
enforcement. It separates what lkjstr can enumerate from browser-reported
origin usage so large storage gaps are actionable instead of dismissed as
harmless overhead.

## Accounting Terms

- **Browser origin usage** is `navigator.storage.estimate().usage`. It is the
  site-wide number cache enforcement targets when the API is available.
- **SQLite table estimates** are bounded table row counts plus ledger-derived
  byte estimates. They describe the current app-owned storage kernel.
- **Ledger-accounted resource bytes** are `cacheLedger.cacheBytes` totals for
  owned resources. They approximate the resource family selected by retention
  and are not physical database file size.
- **Protected data** is account, signing, settings, relay-set, workspace, draft,
  route-block, active job, active snapshot, and safety configuration data.
- **Prunable cache** is recoverable app-managed data with a ledger row, delete
  dispatcher, byte estimate, and no durable or dynamic protection.
- **Old storage** is browser storage from a previous app storage path. It is
  visible in diagnostics but is not scanned row by row.
- **Unknown old or unowned storage** is a database, cache, or key lkjstr can
  enumerate but cannot classify as current protected or ledger-managed data.
- **Residual browser overhead** is the remaining browser origin usage after all
  SQLite, localStorage, Cache Storage, old storage, and unknown estimates are
  subtracted.

## SQLite Rows

Each physical inventory row includes:

- table;
- storage group;
- row count when available;
- ledger bytes when available;
- estimated bytes;
- status;
- reason;
- duration.

The inventory uses typed SQLite repositories and known table ownership. It reads
row counts through bounded statements and ledger summaries through cache ledger
repositories. It does not expose raw SQL to product modules.

## Pressure Byte Summary

Rust Stats projects pressure byte rows only from a saved pressure snapshot. The
rows are:

- browser usage;
- site target;
- protected bytes;
- prunable bytes;
- unknown or unowned bytes;
- residual browser overhead.

When the pressure snapshot is missing, timed out, blocked, corrupt, or otherwise
unavailable, each byte row carries that status and has no byte count. Stats must
not infer byte classes from SQLite table counts alone.

## Old IndexedDB Diagnostics

Old IndexedDB handling is presence-based:

- enumerate database names when `indexedDB.databases()` is available;
- classify known obsolete databases, protected databases, and unknown databases;
- report unavailable or unsupported enumeration explicitly;
- never scan every old object-store row only to render Stats;
- never auto-delete unknown stores.

Old stores are visible rows. They are not folded into residual overhead when the
browser can identify them by database name.

## Non-Indexed Storage

localStorage and Cache Storage are measured as non-indexed browser storage. They
are not authoritative app stores for accounts, secrets, relays, events,
notifications, drafts, workspace state, or feed state.

Cache Storage scans enumerate named caches and request keys when supported.
localStorage scans enumerate keys and values when byte estimates are requested.
Failures remain visible as rows with status and reason.

The current Rust Stats host emits a bounded localStorage count/status row and
Cache Storage request count/status row plus old IndexedDB database presence
rows without scanning localStorage values, response bodies, or old object
stores. localStorage and Cache Storage byte estimates stay in the transitional
TypeScript inventory until equivalent Rust host adapters land.

## Statuses

| Status | Meaning |
| --- | --- |
| `exact` | requested bounded scope was fully enumerated |
| `estimated` | bytes came from ledger or deterministic estimates |
| `partial` | a deadline stopped the read after useful data was collected |
| `timeout` | the deadline passed before useful data existed |
| `unavailable` | the API, worker, or store could not be read |
| `unsupported` | the browser does not expose the needed API |
| `not-applicable` | the group does not use that field |

Partial, timed-out, unavailable, or unsupported evidence is not proof that
protected data can be deleted.

## Gap Rule

Inventory first subtracts enumerated SQLite estimates, ledger estimates, old or
unknown storage, localStorage, and Cache Storage from browser origin usage. Only
the remaining positive gap is `residual-browser-overhead`. If enumeration is
unsupported or incomplete, Stats says that explicitly and does not label the
whole gap as harmless overhead.
