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

## Runtime Return Contract

- Complete proof returns the SQLite page immediately and does not start a relay
  scan for the proven relay, filter, route group, and interval requirements.
- Partial proof returns available cached rows immediately, then starts a relay
  scan only for uncovered requirements. Covered relays stay silent for the
  covered interval.
- Missing proof uses the normal bounded relay scan and records new coverage
  evidence before the segment is treated as durable cache evidence.
- Public feed cache or local-index failures keep the relay route plan alive;
  the failure is a diagnostic and never proves there are no posts.
- Initial feed load attempts local cached display before relay bootstrap when
  cached rows exist. Relay bootstrap may still refresh or fill uncovered gaps.
- Relay updates may replace or extend a staged page after uncovered reads finish;
  the first visible cached rows must not wait for that network work.

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
Hints may be reused only when the semantic feed key, route group, relay URL,
semantic filter key, direction, route fingerprint, and expiry checks match.
Coverage proof remains separate. Detailed hint rules live in
[../network/relay-optimizer/scan-width-adaptation.md](../network/relay-optimizer/scan-width-adaptation.md).

## Status

Interval-union proof and partial relay pruning are implemented inside grouped
feed page scans. Home, Global, Profile post pages, Notifications, and safe
Custom Request event-list reads run a top-level cache-first return path before
relay reads when exact coverage proves visible cached rows. Empty exact
Notifications windows keep a relay-reading footer while probing older history;
they do not render terminal absence from the initial covered interval alone.

Durable warm hints are performance input and are not required for cache proof.
Aggregate scan-hint, decision-trace, and density-model counts are visible in
Stats. The Rust planner classifies hint use, rejection, expiry, and
unavailability in raw decision traces; Stats groups recent trace statuses.
