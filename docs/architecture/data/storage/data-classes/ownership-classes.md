# Ownership Classes

## Purpose

Ownership classes define the exact durable storage categories used by the
manifest, docs, retention, and Stats.

## Classes

- `protected-user-data`: user-owned records that cache pressure never deletes.
- `protected-safety-configuration`: safety or route-suppression records that
  cache pressure never deletes.
- `recoverable-cache`: cached data that can be fetched, derived, or rebuilt.
- `derived-feed-cache`: feed page, coverage, and scan evidence derived from
  events and relay reads.
- `diagnostics-cache`: protocol or relay diagnostics that are useful but
  recoverable.
- `ledger`: accounting rows for recoverable cache resources.
- `metadata`: status or repair metadata owned by storage diagnostics.
- `non-indexed-browser-storage`: measured browser storage outside IndexedDB.
- `unknown-old-or-unowned-storage`: enumerated storage not owned by the
  current manifest or cleanup classifier.
- `residual-browser-overhead`: browser usage not explained by enumerated
  storage estimates.

## Group Mapping

| Class | Inventory group |
| --- | --- |
| `protected-user-data` | `protected` |
| `protected-safety-configuration` | `protected-safety` |
| `recoverable-cache` | `prunable-cache` |
| `derived-feed-cache` | `derived-page-cache` |
| `diagnostics-cache` | `diagnostics` |
| `ledger` | `ledger` |
| `metadata` | `metadata` |
| `non-indexed-browser-storage` | `non-indexed` |
| `unknown-old-or-unowned-storage` | `unknown` |
| `residual-browser-overhead` | `overhead` |

## Rule

No live table may use an undocumented class. No runtime path should treat
`unknown` as a normal table group. If a live store is missing from the manifest,
that is a repository invariant failure.
