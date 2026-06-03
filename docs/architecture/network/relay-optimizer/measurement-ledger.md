# Measurement Ledger

## Purpose

Optimizer rows are recoverable diagnostic cache. They help future reads become
faster and clearer, but they are not protected user data and never prove relay
absence.

## Tables

SQLite worker target tables:

| Table                       | Purpose                                   | Retention                       |
| --------------------------- | ----------------------------------------- | ------------------------------- |
| `relay_read_observations`   | per-relay read diagnostics                | age and count                   |
| `relay_read_scores`         | latest aggregate score per stable context | age and key count               |
| `feed_scan_observations`    | append-only scan segment measurements     | age, key count, pressure        |
| `feed_scan_density_models`  | weighted scan-density model by scope      | age, key count, pressure        |
| `feed_scan_hints`           | last proposed span only                   | age and semantic key count      |
| `feed_scan_decision_traces` | Stats-ready span decisions                | short age and count             |
| `route_evidence_scores`     | measured author route trust               | author plus relay age and count |

All optimizer rows must be counted by storage inventory before product code
depends on them.

## Scan Observation Columns

`feed_scan_observations` records:

```text
id
semantic_feed_key
route_group_key
relay_url
semantic_filter_key
direction
route_fingerprint
since_seconds
until_seconds
requested_limit
effective_limit
event_count
unique_event_count
final_visible_count
event_limit_reached
eose
timeout
closed
auth
socket_error
bytes_sent
bytes_received
started_at_ms
completed_at_ms
created_at_ms
```

## Scan Model Columns

`feed_scan_density_models` records:

```text
model_key
scope
semantic_feed_key
route_group_key
relay_url
semantic_filter_key
direction
route_fingerprint
target_limit_fraction
density_events_per_second
log_density_mean
log_density_variance
sample_weight
complete_window_count
dense_window_count
sparse_window_count
incomplete_window_count
failure_window_count
limit_hit_rate
incomplete_rate
last_good_span_seconds
last_proposed_span_seconds
last_observed_since_seconds
last_observed_until_seconds
updated_at_ms
decays_after_ms
```

Required scopes are Exact, RouteGroup, RelayFilter, SurfaceFilter, Surface,
Global, and Neutral.

## Decision Trace Columns

`feed_scan_decision_traces` records:

```text
trace_id
model_key
semantic_feed_key
route_group_key
relay_url
semantic_filter_key
direction
route_fingerprint
source_scope
confidence
target_count
effective_limit
density_events_per_second
previous_span_seconds
proposed_span_seconds
cap_reason
diagnostics_json
created_at_ms
```

## Repository Rules

- Append observations; upsert density models.
- Select exact and parent models in deterministic scope order.
- Return stale rows with decayed confidence when no better evidence exists.
- Repair reports orphan optimizer ledger rows.
- Retention deletes optimizer rows only.
- Optimizer cleanup never deletes accounts, local signing secrets, settings,
  relay sets, workspace state, Tweet drafts, active tab snapshots, jobs, or
  route blocks.
