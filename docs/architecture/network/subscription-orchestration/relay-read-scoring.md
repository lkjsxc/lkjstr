# Relay Read Scoring

## Purpose

Relay read scoring orders bounded relay attempts and explains diagnostics
without changing correctness. See
[../relay-optimizer/relay-read-scoring.md](../relay-optimizer/relay-read-scoring.md)
for the target Rust-owned scoring model.

Status: Rust owns the pure score reducer in
`crates/lkjstr-relays/src/read_score/`. TypeScript still records product read
statuses and needs the WASM bridge plus durable optimizer rows before the
current wrapper can be deleted.

## Score Key

Durable or in-memory scores use:

`relayUrl + surface + phase + direction + routeGroupKey + filterShape + purpose`

Do not use raw tab ids, pane ids, runtime owners, request ids, or transient
subscription ids in score keys. Those values are diagnostics only. Identical
wire-equivalent requests must still share page-read and lease dedupe.

## Inputs

Each observation may include:

- first event time
- EOSE time
- duration
- event count
- unique event count
- final visible count
- timeout, close, auth, socket error, and event-limit flags
- bytes sent and received
- update time

## Outputs

Scores are bounded numeric fields:

- `reliability`
- `first_event_speed`
- `eose_speed`
- `useful_yield`
- `unique_yield`
- `penalty`
- `fairness_credit`
- `score`
- `sample_count` and `updated_at_ms`

## Update Rules

- Initial scores are neutral so new relays receive attempts.
- EOSE without error raises reliability.
- EVENT before timeout without EOSE raises usefulness but not completeness.
- Timeout, socket error, closed, and auth lower reliability and add penalty.
- Event-limit lowers scan density confidence but is not transport failure.
- Updates use bounded smoothing and clamp every field.
- Stale scores decay toward neutral.

## Scheduling Rules

- Normalize relay URLs before scoring.
- Sort candidate relays by score for the current request context.
- Preserve fairness: low-score relays are delayed, not starved.
- User-disabled or removed relays stay excluded.
- Cancellation by the owning generation stops pending work and ignores late
  observations.

## Ownership

The current TypeScript store is temporary product runtime code. New scoring
logic belongs in `crates/lkjstr-relays/src/read_score/`, and product bridges
must call Rust/WASM when available. Durable rows belong to the SQLite worker
optimizer repositories.
