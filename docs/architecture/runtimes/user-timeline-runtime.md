# User Timeline Runtime

## Purpose

This file defines the tab-owned runtime for public target-user timelines.

## Subject Model

Timeline runtimes distinguish viewer and target:

- `viewerPubkey`: optional active signing account used for local actions.
- `targetPubkey`: public subject whose follow list defines the author set.

Home sets target to the active account and requires it. User Timeline sets target
to the tab pubkey and does not require an active account. Global has no target.

## Query Key

A User Timeline query key includes:

- target pubkey.
- selected read relay fingerprint.
- route fingerprint.
- page size.
- feed policy.

It does not include tab id. Matching tabs may share a query only when all
semantic key fields match. Different target pubkeys must never merge.

## Lease Key

Live and page-read leases include the target pubkey and route fingerprint. This
keeps Alice's public timeline, Bob's public timeline, Home, and Global isolated
while still allowing exact duplicate tabs to share work.

## Startup Flow

1. Load cached latest kind `3` for the target pubkey.
2. Extract valid followee pubkeys and add the target pubkey.
3. Read cached feed rows for that author set only when coverage evidence is
   complete for the query key.
4. Start a bounded latest-kind-`3` read for the target.
5. Start bounded feed-display reads for the current author set.
6. Replan the feed when a newer target follow list arrives.

## Shared Logic

User Timeline uses the Home feed row renderer, sensitive-content gate, profile
hydration, paging, route planning, relay diagnostics, and runtime window caps.
The difference is the target subject and query key.

## Cleanup

Closing the tab releases page-read leases, live leases, profile hydration owner
state, diagnostics, and bounded feed windows. Cleanup is idempotent.
