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

The owner id is the tab id. All cache reads, relay subscriptions, profile
hydration jobs, diagnostics, and visible row windows are scoped to that owner.

## Startup Flow

1. Load cached latest kind `3` for the target pubkey.
2. If a seed follow-list event id is supplied, prefer that cached event when it
   matches the target pubkey and kind `3`.
3. Extract deduplicated valid `p` tags.
4. Render cached rows with unavailable profile metadata fallback.
5. Hydrate visible profile rows through the shared profile coordinator.
6. Start a bounded relay read for latest kind `3` from selected read relays plus
   eligible protocol-derived routes.
7. Replace rows only when a newer valid follow-list event is received.

## Route Hints

The runtime may use selected read relays, target NIP-65 hints, profile relay
hints, relay receipts, and local route evidence. Disabled or removed relays are
excluded. Missing relay answers never prove absence.

## Memory Bounds

The runtime keeps:

- one current follow-list event reference.
- one deduplicated followee vector capped by the actual kind `3` event.
- one visible profile hydration window.
- compact diagnostics per relay.

It does not retain full profile histories or unbounded relay snapshots.

## Cleanup

Closing the tab cancels follow-list reads, releases profile hydration demand,
removes owner-scoped diagnostics, and clears runtime memory. Cleanup is
idempotent.
