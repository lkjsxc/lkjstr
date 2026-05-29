# Cache-First Feed Pages

## Purpose

Define when bounded feed page reads may be satisfied from local storage without
contacting relays.

## Contract

- Cache-first is allowed only for bounded grouped feed segments.
- A cached segment is eligible only when complete coverage proves every required
  route group, relay URL, semantic filter, and requested time interval.
- Complete coverage rows may be merged when they are adjacent or overlapping and
  share the same feed key, route group, relay URL, and semantic filter key.
- Dense, incomplete, unresolved, failed, compacted, expired, or missing rows are
  not proof.
- Event count is not proof. A full cached page does not suppress relay reads by
  itself.
- Covered relays are not queried again for the covered segment.
- Uncovered relays are still queried.
- Cache-first rows use the same display bounds as relay rows.
- Cache-first rows do not wait for profile hydration, reference hydration, or
  relay diagnostics.
- Live subscriptions are not replaced by cache-first reads.

## Scope

Included callers are Home, Global, Profile posts, Notifications, and safe Custom
Request event-list reads when they use grouped bounded scans.

Excluded callers keep exact relay semantics unless another contract says
otherwise: Search, exact id requests, Custom Request filters with `ids` or
`search`, Author Context, Thread reply pages, metadata lookup, follow-list
reads, thread root lookup, and id-batch reference resolution.

## Interval Semantics

Use half-open Unix-second intervals: `[since, until)`.

A requirement with missing `since` or `until` is not cache-provable. Rows prove
only the interval they record. Adjacent rows such as `[100, 160)` and
`[160, 220)` may prove `[100, 220)`.

## Warm Hints

Warm scan hints tune future relay window size. They do not prove absence.
Hints may be reused across adjacent windows and relay groups only as bounded
performance input. Coverage proof remains separate.

## Status

Interval-union proof and partial relay pruning are implemented for grouped feed
page scans. Durable warm hints remain in progress and are not required for cache
proof.
