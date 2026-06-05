# User Timeline Runtime

## Purpose

This file defines the tab-owned runtime for public target-user timelines.

## Subject Model

Timeline runtimes distinguish viewer and target:

- `viewerPubkey`: optional active signing account used for local actions.
- `targetPubkey`: public subject whose follow list defines the author set.

Home sets target to the active account and requires it. User Timeline sets target
to the tab pubkey and does not require an active account. Global has no target.

## Target Follow-List Dependency

User Timeline depends on the target follow-list runtime. Cached kind `3` data may
seed the author set immediately. Relay discovery runs in parallel and replans the
feed when a newer target follow list appears.

## Author Set

The author set is target pubkey plus valid deduplicated followee pubkeys. If the
follow list is absent or discovery is incomplete, the runtime may read only the
target pubkey as degraded target-posts-only mode.

## Query And Route Fingerprint

A query key includes target pubkey, selected read-relay fingerprint, route
fingerprint, author-set hash, filter shape, page size, and feed policy. It does
not include tab id. Matching tabs may share work only when all semantic fields
match.

Routes can include selected relays, NIP-65 routes, follow-list relay hints,
receipt routes, local route evidence, and selected-relay fallback. Disabled or
removed relays are excluded.

## Cache-First Coverage Proof

Cached rows render before relay results only with complete coverage evidence for
semantic feed key, selected relay fingerprint, route fingerprint, author-set
hash, filter shape, and interval. Missing, compacted, stale, failed, dense, or
incomplete evidence cannot prove absence.

## Startup Flow

1. Load cached target follow list.
2. Derive author set and read covered cached rows when coverage proves them.
3. Start target follow-list discovery.
4. Start target-post reads for degraded mode while discovery is pending.
5. When a follow list is found, store it, derive the author set, hydrate visible
   authors, and start feed reads for that author set.
6. If absence is proven, keep target-posts-only mode when real posts exist.
7. If reads are partial, show retryable diagnostics without clearing cache.

## Paging And Snapshots

Older and newer paging use shared feed readers, scan-density span planning,
route fingerprints, progressive snapshots, cursor preservation, and cache
coverage writes. The runtime preserves anchors across relayout and never marks
history exhausted from incomplete relay evidence.

## Cleanup

Closing the tab releases page-read leases, live leases, follow-list discovery,
profile hydration owner state, diagnostics, open reference pins, and bounded
feed windows. Cleanup is idempotent and keeps only compact tab snapshots.

## Tests

Tests cover cache hit, relay follow-list found, degraded target-posts-only mode,
proven absence, partial failure, disabled relay exclusion, older-load planning,
cache coverage mismatch, duplicate-tab work sharing, and owner cleanup.
