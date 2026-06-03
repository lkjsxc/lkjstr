# Scan Width Adaptation

## Purpose

Adaptive grouped scans use previous real segment feedback to choose a better
starting span for the next compatible scan. Hints improve speed only; coverage
proof remains separate.

## Compatibility

A hint may be used only when all fields match the next scan:

- semantic feed key
- route group key
- relay URL
- semantic filter key
- direction
- route fingerprint
- account or target identity embedded in the semantic feed key
- selected relay set, page size, feed policy, and request mode embedded in the
  semantic feed key
- non-expired hint time

Hints must not be reused across accounts, profiles, notification keys, selected
relay sets, filter shapes, route fingerprints, request modes, or tab ids.

## Initial Span

- No compatible hint: start at `60` seconds.
- Compatible hint: start at its `next_span_seconds`, clamped to configured
  minimum and maximum bounds.
- The initial span source is recorded as durable, neutral, expired,
  incompatible, or unavailable.

## Feedback

| Feedback | Meaning | Next-span rule |
| --- | --- | --- |
| `limit-hit` | at least one relay-shaped request hit its effective limit | split near visible edge; shrink starting span |
| `under-half` | all contacted relays completed and returned at most half limit | double span within cap |
| `balanced` | complete, neither dense nor sparse | keep span |
| `incomplete` | EOSE proof missing or terminal failure present | do not double; shrink only when large |

Density is per relay and per relay-shaped request. Aggregate counts across
relays cannot create dense or sparse proof.

## Window Rules

- Dense windows split the current segment and process the half closest to the
  visible edge first.
- Unsplittable dense windows become unresolved frontiers.
- Sparse complete windows may grow toward the cap but do not skip coverage
  requirements.
- Repeated dense windows converge downward.
- Repeated incomplete windows reduce confidence, keep conservative spans, and
  show diagnostics.
- Incomplete windows never prove history exhaustion.
- Dense, incomplete, unresolved, failed, stale, missing, compacted, and expired
  rows never prove cache absence.

## Trace

Every grouped scan emits a trace:

```text
semantic_feed_key
direction
hint_used
initial_span_seconds
segments_processed
feedback_counts
next_hint
```

Stats uses the trace to show whether learning happened and why a hint was used
or rejected.
