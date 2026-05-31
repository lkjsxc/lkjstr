# Storage Inventory

## Purpose

Inventory explains browser-owned storage for Stats, repair, and cache pressure
enforcement. It separates what lkjstr can enumerate from browser-reported
origin usage so large storage gaps are actionable instead of dismissed as
harmless overhead.

## Accounting Terms

- **Browser origin usage** is `navigator.storage.estimate().usage`. It is the
  site-wide number cache enforcement targets when the API is available.
- **Physical object-store bytes** are JSON-encoding estimates for rows found in
  a concrete IndexedDB object store. They describe store footprint, not ledger
  ownership.
- **Ledger-accounted resource bytes** are `cacheLedger.cacheBytes` totals for
  owned resources. They approximate the resource family selected by retention
  and are not the physical size of the `cacheLedger` store.
- **Protected data** is account, signing, settings, relay-set, workspace, draft,
  route-block, active job, active snapshot, and safety configuration data.
- **Prunable cache** is recoverable app-managed data with a ledger row, delete
  dispatcher, byte estimate, and no durable or dynamic protection.
- **Unknown old or unowned storage** is an IndexedDB database or object store
  lkjstr can enumerate but cannot classify as a current protected or
  ledger-managed store.
- **Residual browser overhead** is the remaining browser origin usage after all
  enumerated IndexedDB, localStorage, and Cache Storage estimates are subtracted.

## IndexedDB Rows

Each table inventory row includes:

- database
- object store
- data class
- inventory group
- ownership
- rows scanned
- estimated bytes
- status
- reason
- scan duration

The inventory enumerates every IndexedDB database through
`indexedDB.databases()` when supported. For the `lkjstr` database it opens the
database and scans every object store in `objectStoreNames`, including old
or unexpected stores not present in the current Dexie manifest. Other
enumerated databases are reported as recoverable, protected, or unknown at the
database level unless a cleanup allowlist classifies them more precisely.

Known stores come from the Storage Manifest. Old and unknown stores are
visible rows; they are never folded into residual overhead while enumeration
was possible.

## Scan Rules

Scans are chunked so the UI can breathe between batches. Each store has a
deadline and the full inventory run has a global deadline. A scan that reaches
its deadline returns the bytes and row count collected so far and reports that
it is partial.

Statuses are:

| Status | Meaning |
| --- | --- |
| `exact` | requested scope was fully enumerated |
| `partial` | a deadline stopped the scan after some rows or stores were read |
| `timeout` | the scan reached a deadline before a useful row estimate existed |
| `unavailable` | the API or store exists but could not be read |
| `unsupported` | the browser does not expose the needed API |

Partial or timed-out scans are not exact. Missing object stores report
`unavailable`. No missing, partial, or unsupported evidence is treated as proof
that protected data can be deleted.

## Non-Indexed Storage

localStorage and Cache Storage are measured as non-indexed browser storage.
They are not authoritative app stores for accounts, secrets, relays, events,
notifications, drafts, workspace state, or feed state.

Cache Storage scans enumerate named caches and response bodies when supported.
localStorage scans enumerate keys and values. Failures remain visible as
non-indexed rows with status and reason.

## Gap Rule

Inventory first subtracts enumerated current stores, old or unknown stores,
localStorage, and Cache Storage from browser origin usage. Only the remaining
positive gap is `residual-browser-overhead`. If IndexedDB database enumeration
is unsupported or incomplete, Stats says that explicitly and does not label the
whole gap as unknowable.
