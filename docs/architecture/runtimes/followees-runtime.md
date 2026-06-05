# Followees Runtime

## Purpose

This file defines the tab-owned runtime for Followees tabs.

## Input And Owner

The runtime key includes:

- workspace id.
- tile id.
- tab id.
- target profile pubkey.
- optional source follow-list event id.
- selected read-relay fingerprint.

The owner id is the tab id. Cache reads, relay reads, profile hydration,
diagnostics, and visible row windows are scoped to that owner and are cancelled
when the owner closes.

## Target Follow-List Discovery

Startup is cache-first and relay-backed:

1. Load cached latest kind `3` for the target pubkey.
2. Prefer a supplied cached seed event when it matches target and kind `3`.
3. Extract deduplicated valid `p` tags and render cache rows immediately.
4. Start bounded relay discovery unless the caller explicitly suppresses it.
5. Read groups in order: selected relays, author routes or NIP-65 routes,
   receipt routes, discovery fallback.
6. Store the newest found event and provenance with typed repositories.
7. Replace rows only when the new event is newer than the current event.

A cache miss is a discovery state. It is not proof of absence.

## Profile Hydration

Only visible and near-visible followee pubkeys submit hydration demand. Hydration
uses the shared profile coordinator, selected relays, valid row relay hints, and
bounded target routes. Hidden or closed tabs release owner demand.

## Scroll Virtualization

Followees uses the shared feed scroll surface or equivalent virtual list. The
pane owns the scroll element, bottom rows are reachable, and row actions stay in
an action zone that does not trigger row navigation.

## Route Groups

Eligible routes are:

- selected read relays.
- target NIP-65 read or both relays.
- local author routes.
- receipts for known kind `3` events.
- small configured discovery fallback relays.

Disabled or removed relays are excluded. Discovery fallback is lower-confidence
and bounded.

## Retry And Unavailable States

Runtime states are `idle`, `cache_hit`, `reading_selected`,
`reading_author_routes`, `reading_receipt_routes`, `reading_discovery`, `found`,
`empty_follow_list`, `not_found_proven`, `partial_failure`, `all_failed`, and
`aborted`.

Timeout, AUTH, socket close, or relay failure produces retryable diagnostics and
never proves absence. `not_found_proven` requires complete EOSE evidence from all
attempted relay groups and no newer cache result.

## Stats Counters

Stats records selected group, attempted relays, failed relays, returned relay
urls, valid entry count, invalid tag count, final state, retry count, and whether
Rust or TypeScript parsed the follow list.

## Tests

Tests cover cache hit, selected-relay found, NIP-65 found, receipt-route found,
discovery fallback, partial failure, all failed, disabled relay exclusion,
duplicate `p` tags, invalid tags, retry, and owner cleanup.
