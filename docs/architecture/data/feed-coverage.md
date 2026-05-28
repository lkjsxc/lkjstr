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

## Status

Only complete coverage can prove a range. Complete coverage means the relevant
relay-shaped request contacted a meaningful source, completed normally, did not
hit the effective limit, and returned only events inside the requested segment.

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

## Cache Use

Cache-first rendering is allowed only when coverage proves every required
feed-key, route-group, relay, filter, and range row complete. The local event
repository then serves the rows inside the same display bounds that relay
rendering would apply.

Compaction invalidates affected coverage. Coverage can store next-span hints,
but the scanner must still validate direction and segment bounds before using
them.
