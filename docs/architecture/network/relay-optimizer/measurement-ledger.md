# Measurement Ledger

## Purpose

Optimizer data is recoverable diagnostic cache. It helps future relay reads get
faster and clearer, but it is not protected user data and it is not proof that a
relay lacks events.

## Tables

The SQLite worker target owns these optimizer records:

| Table | Purpose | Retention |
| --- | --- | --- |
| `relay_read_observations` | recent per-relay read diagnostics | bounded by age and count |
| `relay_read_scores` | latest aggregate score per stable score key | bounded by age and key count |
| `feed_scan_hints` | next-span hints for compatible grouped scans | bounded by age and semantic key count |
| `route_evidence_scores` | measurement-informed author route trust | bounded by author plus relay age and count |

Existing `feed_scan_hints` rows stay recoverable page-cache data. New optimizer
rows must be ledger-backed or otherwise counted by the storage inventory before
product code depends on them.

## Observation Columns

`relay_read_observations` records:

```text
id
relay_url
surface
phase
direction
route_group_key
semantic_feed_key
semantic_filter_key
purpose
started_at_ms
first_event_ms
eose_ms
duration_ms
event_count
unique_event_count
final_count
timeout
closed
auth
socket_error
event_limit_reached
bytes_sent
bytes_received
route_evidence_sources
created_at_ms
```

## Score Columns

`relay_read_scores` records the latest aggregate for:

```text
relay_url
surface
phase
direction
route_group_key
filter_shape
purpose
reliability
first_event_speed
eose_speed
useful_yield
unique_yield
penalty
fairness_credit
sample_count
updated_at_ms
```

## Scan Hint Columns

`feed_scan_hints` records:

```text
semantic_feed_key
route_group_key
relay_url
semantic_filter_key
direction
route_fingerprint
current_span_seconds
next_span_seconds
min_span_seconds
max_span_seconds
last_feedback
density_ewma
complete_window_count
dense_window_count
incomplete_window_count
last_since
last_until
updated_at_ms
expires_at_ms
```

## Route Evidence Columns

`route_evidence_scores` records:

```text
author_pubkey
relay_url
surface
source
source_confidence
measured_success
measured_failure
last_success_at_ms
last_failure_at_ms
updated_at_ms
```

## Rules

- Observation rows are append-only diagnostics until retention deletes them.
- Score rows are replaceable aggregates keyed by stable request context.
- Scan hints are compatible only when semantic feed key, route group, relay URL,
  semantic filter key, direction, and route fingerprint still match.
- Tab ids, pane ids, owner handles, request ids, and subscription ids are never
  part of durable keys.
- Retention deletes optimizer records through documented cache or diagnostic
  paths and reports counts in Stats.
