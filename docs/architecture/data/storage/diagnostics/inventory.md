# Inventory

## Purpose

Inventory estimates browser-owned storage for Stats and cache pressure
explanation.

## IndexedDB Rows

Each table inventory row includes:

- table
- data class
- inventory group
- rows scanned
- estimated bytes
- status
- reason
- scan duration

Statuses are `exact`, `timeout`, `unavailable`, and `unsupported`.

## Scan Rules

Table scans are sequential or bounded by a small concurrency cap. Each table
has a deadline and the full inventory run has a global deadline.

Timed-out scans keep partial bytes and report `timeout`. Missing object stores
report `unavailable`. No missing store is treated as proof that protected data
can be deleted.

## Non-Indexed Storage

localStorage and Cache Storage are measured as non-indexed browser storage.
They are not authoritative app stores for accounts, secrets, relays, events,
notifications, drafts, workspace state, or feed state.

Browser overhead or unaccounted usage is reported as
`browser-overhead-or-unknown`.
