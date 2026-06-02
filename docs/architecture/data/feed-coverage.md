# Feed Coverage

## Purpose

Feed coverage records what a relay-shaped request proved about a feed range. It
is evidence for scanner and cache decisions, not raw event storage.

## Identity

Coverage rows are keyed by:

- semantic feed key
- route group
- relay URL
- semantic filter key
- `since`
- `until`

The semantic feed key includes the surface identity, account or target pubkey
when relevant, selected relay set, page size, feed policy, route fingerprint,
and request mode. Two surfaces may share cached events, but they may not share
coverage unless those identity fields match.

## Proof Query Contract

Steady-state proof queries are exact. They filter by feed key, route group,
relay URL, semantic filter key, `status = 'complete'`, and interval overlap with
`[since, until)`. A feed-key-only read is allowed only as a bounded diagnostic
or migration path; it must not decide cache-first correctness.

The proof reader may merge the exact complete rows in pure code or SQL. It must
return the uncovered relay, filter, route group, and interval requirements so the
runtime can query only those gaps.

## Status

Only complete coverage can prove a range. Complete coverage means the relevant
relay-shaped request contacted a meaningful source, completed normally, did not
hit the effective limit, and returned only events inside the requested segment.

Coverage rows use half-open Unix-second intervals: `[since, until)`. A
requirement with a missing `since` or `until` is unproven.

Complete rows with the same semantic feed key, route group, relay URL, and
semantic filter key may merge when they are adjacent or overlapping. A single
gap makes the requirement unproven. A larger complete row may prove a smaller
requested segment inside it.

Dense coverage records a limit-hit range and is useful for future shrinking. It
does not prove completeness and cannot suppress a relay read.

Incomplete, failed, unresolved, missing, expired, or compacted coverage records
are diagnostics and retry inputs. They do not prove that absent rows are absent.

## Relay Granularity

Coverage must be recorded per relay and per relay-shaped request. Aggregate
batch counts are diagnostic only and must not decide that every relay is dense,
sparse, or complete.

Relay-specific coverage records the effective limit, observed count, unique
count, event count, feedback, direction, current span, and optional next-span
hint when those values are known.

## Partial Relay Proof

Coverage proof remains relay-specific. If relay A has complete interval-union
proof for a segment and relay B does not, only relay B should be queried for
that segment. Cached rows from covered relays and relay rows from uncovered
relays merge through the normal feed reducer.

## Cache Use

Cache-first rendering is allowed only when exact coverage proof covers every
required feed-key, route-group, relay, filter, and interval. The local event
repository then serves the rows inside the same display bounds that relay
rendering would apply. Event count is not proof.

Compaction invalidates affected coverage. Warm scan hints are performance input
only. Dense rows may inform future shrinking, but they do not prove absence.
