# Scan Width Adaptation

## Purpose

Adaptive grouped scans choose the next relay-shaped time span from real event
density. The optimizer improves speed only; coverage proof remains interval
union coverage.

Status: Rust owns the pure span planner target. Product wiring persists scan
observations and density models through SQLite, exposes decisions through WASM
and Stats, and uses TypeScript only as an explicit bridge-unavailable fallback.

## Durable Objects

Scan hints are not enough. The durable source of truth is:

- scan density model: weighted event-density evidence for a stable context and
  fallback scope.
- last-span hint: the most recent usable span, used only to cap sudden changes.
- decision trace: the chosen span and why it was chosen.

`feed_scan_hints` may remain as a thin last-span table. New decisions must read
`feed_scan_density_models` first and may append `feed_scan_decision_traces`.

## Rust Wiring Contract

The Rust span planner is authoritative when the WASM bridge is loaded. Shipped
feed surfaces must report whether each decision used Rust or TypeScript
fallback. Fallback exists only to keep the browser usable when the bridge is
unavailable; it must use the same input contract and cannot invent coverage.

Stats shows the bridge source, selected model scope, confidence, proposed span,
cap reason, and fallback reason when applicable.

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
subscription ids, cursors, or transient runtime identifiers. Page read keys may
include cursors for request dedupe; scan model semantic keys must stay stable
across older and newer cursor movement.

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
  `effective_limit / span_seconds`; the next span targets two thirds occupancy.
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

## Product Consumption

Older loads choose the first span from persisted density models, then warm the
next likely older span while the user is reading near the bottom. Matching page
reads dedupe by semantic key, route fingerprint, relay group, direction, and
interval. Dense windows split earlier; sparse complete windows grow within caps.

## Stats Trace

Every chosen span reports selected source scope, fallback level, confidence,
sample weight, target count, effective limit, density estimate, target fraction,
previous span, proposed span, cap application, latest observation count,
limit-hit rate, incomplete rate, neutral reason, and Rust-vs-fallback status.

## Correctness Boundaries

Scan density evidence is performance input only. It never proves cache absence,
suppresses uncovered relays, overrides disabled-relay exclusion, or marks
incomplete history exhausted.
