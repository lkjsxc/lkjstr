# Relay Read Scoring

## Purpose

Relay read scoring orders enabled relay attempts for a specific request context.
It is advisory. It cannot delete a route, bypass selected fallback, override
user blocks, or make cache absence claims.

Status: Rust owns the pure reducer in `crates/lkjstr-relays/src/read_score/`,
`lkjstr-storage` owns durable score rows, and `lkjstr-web` exposes a relay-score
WASM bridge. Product read-path wiring and Stats projection are still open.

## Stable Key

A score key is:

```text
relay_url
surface
phase
direction
route_group_key
filter_shape
purpose
```

The normalized filter shape removes object-key ordering noise and excludes tab,
pane, owner, request, and subscription identifiers.

## Observation Fields

A read observation may include first-event time, EOSE time, duration, event
count, unique event count, final visible count, timeout, close, auth, socket
error, event-limit state, bytes sent, bytes received, and update time.

## Components

| Component | Meaning |
| --- | --- |
| `reliability` | EOSE without terminal failure is strong positive evidence |
| `first_event_speed` | lower latency to first useful event is better |
| `eose_speed` | lower latency to complete EOSE is better |
| `useful_yield` | matching event yield for the request shape |
| `unique_yield` | non-duplicate contribution across relays |
| `penalty` | timeout, close, auth, socket error, and mild density cost |
| `fairness_credit` | bounded retry credit for old low-score entries |

All components are clamped to `[0.0, 1.0]`.

## Score Formula

```text
score =
  reliability       * 0.34
+ first_event_speed * 0.18
+ eose_speed        * 0.12
+ useful_yield      * 0.16
+ unique_yield      * 0.10
+ fairness_credit   * 0.05
- penalty           * 0.35
```

## Update Rules

- New relays start neutral and must receive attempts.
- EOSE without terminal failure raises reliability.
- EVENT before timeout without EOSE raises usefulness but not completeness.
- Timeout, close, auth, and socket error lower reliability and add penalty.
- `event_limit_reached` is density evidence with a mild penalty; it is not a
  relay transport failure.
- The first sample fully replaces neutral components.
- Samples two through twenty use weight `0.25`.
- Later samples use weight `0.10`.
- Stale scores decay toward neutral after the configured half-life.

## Fairness

- Low-score relays are delayed, not starved.
- Relays earn bounded retry credit after they have not been sampled for a while.
- User-disabled relays are never fairness candidates.
- Fairness credit affects ordering only; it is not a quality claim.
