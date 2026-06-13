# User Timeline Runtime

## Purpose

This file defines the tab-owned runtime for public target-user timelines.

## Subject Model

Timeline runtimes distinguish viewer and target:

- `viewerPubkey`: optional active signing account used for local actions.
- `targetPubkey`: public subject whose follow list defines the author set.

Home sets target to the active account and requires it. User Timeline sets target
to the tab pubkey and does not require an active account. Global has no target.

## Discovery Dependency

User Timeline depends on the target follow-list runtime. Cached kind `3` data may
seed the author set immediately when coverage evidence is sufficient. Relay
discovery still runs and replans the feed when a newer target follow list
appears.

Discovery states carry attempted, successful, failed, and pending route groups;
newest follow-list event id; reason codes; and retry affordances. Cache miss is a
discovery trigger, not absence proof.

## Author Set

The author set is target pubkey plus valid deduplicated followee pubkeys. If the
follow list is unavailable but target-authored posts are reachable, the runtime
may read only the target pubkey as labeled target-posts-only mode. It must not
synthesize followees or claim the target follows nobody.

## Query And Route Fingerprint

A query key includes target pubkey, selected read-relay fingerprint, route
fingerprint, author-set hash, filter shape, page size, and feed policy. It does
not include tab id. Matching tabs may share work only when all semantic fields
match.

Routes can include selected relays, target event relays, profile provenance,
NIP-65 routes, follow-list relay hints, receipt routes, event tag hints, local
route evidence, previously successful route groups, and selected-relay fallback.
Disabled or removed relays are excluded.

## Cache-First Coverage Proof

Cached rows render before relay results only with complete coverage evidence for
semantic feed key, selected relay fingerprint, route fingerprint, author-set
hash, filter shape, and interval. Missing, compacted, stale, failed, dense, or
incomplete evidence cannot prove absence.

## Startup Flow

1. Load cached target follow list and route evidence.
2. Derive author set and read covered cached rows when coverage proves them.
3. Start selected-relay and target-route follow-list discovery.
4. Start target-post reads for degraded mode while discovery is pending.
5. Add real NIP-65 and provenance routes when evidence is available.
6. When a follow list is found, store it, derive the author set, hydrate visible
   authors, and start feed reads for that author set.
7. If discovery is incomplete, keep partial or target-posts-only rows when real
   data is available and show retryable diagnostics.
8. If reads are partial, failed, auth-required, rate-limited, or offline, show
   structured diagnostics without clearing cache.

## Retry Policy

Retries are explicit and bounded. The runtime may retry failed routes, selected
relays, target hints, known provenance relays, and imported suggestions. It must
back off repeated failures, avoid unbounded relay fanout, and keep disabled
relays excluded.

## Paging And Snapshots

Older and newer paging use shared feed readers, scan-density span planning,
route fingerprints, progressive snapshots, cursor preservation, height
reservation, and cache coverage writes. The runtime preserves anchors across
relayout and never marks history exhausted from incomplete relay evidence.

## Cleanup

Closing the tab releases page-read leases, live leases, follow-list discovery,
profile hydration owner state, diagnostics, open reference pins, and bounded
feed windows. Cleanup is idempotent and keeps only compact tab snapshots.

## Tests

Tests currently cover cache hit, cache miss triggering relay discovery,
selected-relay success, NIP-65/provenance/target-route success, partial route
failure diagnostics, no-event retry, auth-required, rate-limited, and timeout
selected relays, disabled-relay exclusion, honest target-posts-only mode,
bounded retry expansion, incomplete reason codes, and owner cleanup. Coverage,
older-load planning, and work-sharing proof remain open.
