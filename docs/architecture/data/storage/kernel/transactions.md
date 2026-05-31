# Transactions

## Purpose

Transactions define which rows must be written together so cache pressure,
repair, and Stats never observe half-owned durable resources.

## Write Families

| Family | Tables |
| --- | --- |
| event write | `events`, `eventRelays`, `eventTags`, `cacheLedger` |
| feed cursor write | `feedCursors`, `cacheLedger` |
| feed coverage write | `feedCoverage`, `cacheLedger` |
| feed scan hint write | `feedScanHints`, `cacheLedger` |
| notification write | `notifications`, `cacheLedger` |
| job write | `jobs`, `cacheLedger` unless active protected job policy applies |
| relay diagnostic write | `relayDiagnosticSummaries`, `cacheLedger` |
| relay information write | `relayInformation`, `cacheLedger` |
| relay suggestion write | `relayListSuggestions`, `cacheLedger` |
| author route write | `authorRelayRoutes`, `cacheLedger` |
| tab snapshot write | `tabStates`, `cacheLedger` |
| protected settings write | target protected table only |

## Helper Rule

The transaction helper receives manifest table names, purpose, mode, and a
function that runs against the Dexie database. It records operation telemetry
and normalizes Dexie errors into storage failure reasons.

Feature repositories receive typed transaction results. UI adapters decide
which fallback is acceptable for the current user flow.

## Atomicity Rule

A ledger-backed resource row and its ledger row are one transactional resource.
Repair is allowed to backfill missing ledger rows after old data or failures,
but normal writers must not create new drift.
