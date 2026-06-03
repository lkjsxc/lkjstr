# Scan Width Adaptation

## Purpose

Adaptive grouped scans choose the next relay-shaped time span from real event
density. The optimizer improves speed only; coverage proof remains interval
union coverage.

Status: Rust owns the pure scan planner target. Product wiring must persist scan
observations and density models through SQLite and expose decisions through WASM
and Stats.

## Durable Objects

Scan hints are not enough. The durable source of truth is:

- scan density model: weighted event-density evidence for a stable context and
  fallback scope.
- last-span hint: the most recent usable span, used only to cap sudden changes.
- decision trace: the chosen span and why it was chosen.

`feed_scan_hints` may remain as a thin last-span table. New decisions must read
`feed_scan_density_models` first and may append `feed_scan_decision_traces`.

## Context And Scopes

Density is per relay and per relay-shaped request. Aggregate counts across
relays cannot decide dense or sparse state.

Scopes are consulted in deterministic order:

1. Exact: surface, route group, relay, filter, direction, route fingerprint.
   Exact rows are rejected when the route fingerprint differs.
2. RouteGroup: surface plus route group and direction.
3. RelayFilter: relay plus filter and direction.
4. SurfaceFilter: surface plus filter and direction.
5. Surface: surface plus direction.
6. Global: direction only.
7. Neutral: configured prior.

Parent keys deliberately omit fields and ignore omitted fields during matching.
Durable keys must never contain tab ids, pane ids, owner handles, request ids,
subscription ids, or transient runtime identifiers.

## Span Formula

The default target occupancy is two thirds of the effective limit for the exact
request shape. The target fraction is configurable.

```text
target_count = max(1, floor(effective_limit * target_numerator / target_denominator))
raw_span = target_count / max(density_estimate, minimum_density_per_second)
bounded_span = clamp(raw_span, min_span_seconds, max_span_seconds)
proposal = clamp(bounded_span, previous_span / max_change, previous_span * max_change)
```

The default maximum single-change factor is `4.0`. If the most recent usable
span is `600`, one proposal stays inside `[150, 2400]` unless min or max span
bounds are stricter.

## Evidence Rules

- Complete non-limit observations give exact density from
  `final_visible_count / span_seconds`.
- Limit-hit observations are censored density evidence. True density is at least
  `effective_limit / span_seconds`; the next span targets two thirds occupancy
  and does not simply halve.
- Sparse complete observations compute the needed span from density. They may
  grow by more than two times, capped by the configured change factor.
- Incomplete observations may add weak lower-confidence density when events
  arrived. They strongly raise incomplete and failure rates.
- Timeout, close, auth, and socket-error observations never prove historical
  exhaustion.
- Zero-event complete observations do not create infinite spans. Parent density,
  neutral prior, minimum density, and the change cap bound the result.
- Repeated failures lower confidence and add diagnostics. They do not globally
  reset scan width.

## Staleness

Expired evidence decays in confidence and weight. It is not discarded while no
better parent evidence exists. A stale exact model may blend with fresh parent
evidence or lose to that parent. Missing or incompatible last-span hints do not
force a reset to sixty seconds when parent density exists.

## Stats Trace

Every chosen span reports:

- selected source scope and fallback level
- confidence and sample weight
- target count and effective limit
- density estimate and target fraction
- previous span and proposed span
- cap application and cap factor
- latest observation count
- limit-hit rate and incomplete rate
- neutral reason when neutral was used

## Correctness Boundaries

Scan density evidence is performance input only. It never proves cache absence,
suppresses uncovered relays, overrides disabled-relay exclusion, or marks
incomplete history exhausted.
