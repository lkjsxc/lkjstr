# Retention Commands

## Purpose

Retention command metadata tracks pressure snapshots, cache ledger reads, delete
dispatch, optimizer rows, and Stats inventory. Retention must delete only
ledger-backed prunable rows and must report exact stop reasons.

## Current Next Edit

1. Keep the pure Rust planner, command metadata, and dispatch adapter aligned
   with the statement ids below.
2. Product retention planning must consume the storage-owned readiness
   classifier before deriving byte targets from a pressure snapshot.
3. Keep batch outcome mapping covered by `retention_dispatch_failure_test.rs`.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `storage-pressure.get` | implemented | pressure | read | `StoragePressureGetInput` | `StoragePressureGetOutput` | `cache_meta.select` | `cache_meta` | `storage_pressure_from_sqlite_row` | pressure decode | metadata | none | recoverable-diagnostics | pressure | `sqlite_store/pressure.rs` | cache repositories | `commands_diagnostics_test.rs` | Rust Stats parity plus no-import proof |
| `storage-pressure.put` | implemented | pressure | write | `StoragePressurePutInput` | `StoragePressurePutOutput` | `cache_meta.upsert` | `cache_meta` | `sqlite_storage_pressure_snapshot_row` | pressure decode, write/quota | metadata | none | recoverable-diagnostics | pressure | `sqlite_store/pressure.rs` | cache repositories | `commands_diagnostics_test.rs` | Rust Stats parity plus no-import proof |
| `storage-pressure.project-stats` | implemented | pressure | inventory | `StoragePressureProjectInput` | `StoragePressureProjectOutput` | `cache_meta.select` | `cache_meta` | `storage_pressure_from_sqlite_row` | pressure decode | metadata | none | recoverable-diagnostics | pressure | `lkjstr-storage/src/stats.rs` | cache repositories | `commands_diagnostics_test.rs` | Rust Stats parity plus no-import proof |
| `storage-inventory.snapshot` | implemented | inventory | inventory | `StorageInventorySnapshotInput` | `StorageInventorySnapshotOutput` | inventory-only generated count SQL | inventory-only | `storage_stats_snapshot_from_sqlite_counts` | storage unavailable, timeout, blocked, corrupt | metadata | none | inventory-only | inventory | `sqlite_store/inventory.rs` | cache repositories | command inventory | Rust Stats parity plus no-import proof |
| `optimizer.feed-scan-observation.insert` | implemented | optimizer | write | `FeedScanObservationInsertInput` | `FeedScanObservationInsertOutput` | `feed_scan_observations.insert` | `feed_scan_observations` | `sqlite_scan_observation_row` | optimizer decode, write/quota | diagnostics-cache | none | recoverable-diagnostics | optimizer | scan-model storage path | scan-model repositories | `commands_optimizer_test.rs` | Rust optimizer parity plus no-import proof |
| `optimizer.feed-scan-density-model.select-context` | implemented | optimizer | read | `FeedScanDensityModelSelectContextInput` | `FeedScanDensityModelSelectContextOutput` | `feed_scan_density_models.select_context` | `feed_scan_density_models` | `scan_density_model_from_sqlite_row` | optimizer decode | diagnostics-cache | none | recoverable-diagnostics | optimizer | scan-model storage path | scan-model repositories | `commands_optimizer_test.rs` | Rust optimizer parity plus no-import proof |
| `optimizer.feed-scan-density-model.upsert` | implemented | optimizer | write | `FeedScanDensityModelUpsertInput` | `FeedScanDensityModelUpsertOutput` | `feed_scan_density_models.upsert` | `feed_scan_density_models` | `sqlite_scan_density_model_row` | optimizer decode, write/quota | diagnostics-cache | none | recoverable-diagnostics | optimizer | scan-model storage path | scan-model repositories | `commands_optimizer_test.rs` | Rust optimizer parity plus no-import proof |
| `optimizer.feed-scan-decision-trace.insert` | implemented | optimizer | write | `FeedScanDecisionTraceInsertInput` | `FeedScanDecisionTraceInsertOutput` | `feed_scan_decision_traces.insert` | `feed_scan_decision_traces` | `sqlite_scan_decision_trace_row` | optimizer decode, write/quota | diagnostics-cache | none | recoverable-diagnostics | optimizer | scan-model storage path | scan-model repositories | `commands_optimizer_test.rs` | Rust optimizer parity plus no-import proof |
| `optimizer.feed-row-height-observation.insert` | partial | optimizer | write | `FeedRowHeightObservationInsertInput` | `FeedRowHeightObservationInsertOutput` | `feed_row_height_observations.insert` | `feed_row_height_observations` | `sqlite_feed_row_height_observation_row` | optimizer decode, write/quota | diagnostics-cache | none | recoverable-diagnostics | optimizer | `sqlite_store/feed_geometry.rs` | row-height session maps | `commands_optimizer_test.rs`, `geometry_rows_test.rs` | feed consumption, Stats projection, and no-import proof |
| `optimizer.feed-row-height-observation.prune-before` | partial | optimizer | write | `FeedRowHeightObservationPruneInput` | `FeedRowHeightObservationPruneOutput` | `feed_row_height_observations.delete_before` | `feed_row_height_observations` | `sqlite_feed_row_height_observation_row` | optimizer decode, write/quota | diagnostics-cache | none | recoverable-diagnostics | optimizer | `sqlite_store/feed_geometry.rs` | row-height session maps | `commands_optimizer_test.rs` | feed consumption, Stats projection, and no-import proof |
| `optimizer.feed-row-height-model.select` | partial | optimizer | read | `FeedRowHeightModelSelectInput` | `FeedRowHeightModelSelectOutput` | `feed_row_height_models.select` | `feed_row_height_models` | `feed_row_height_model_from_sqlite_row` | optimizer decode | diagnostics-cache | none | recoverable-diagnostics | optimizer | `sqlite_store/feed_geometry.rs` | row-height session maps | `commands_optimizer_test.rs`, `geometry_rows_test.rs` | feed consumption, Stats projection, and no-import proof |
| `optimizer.feed-row-height-model.upsert` | partial | optimizer | write | `FeedRowHeightModelUpsertInput` | `FeedRowHeightModelUpsertOutput` | `feed_row_height_models.upsert` | `feed_row_height_models` | `sqlite_feed_row_height_model_row` | optimizer decode, write/quota | diagnostics-cache | none | recoverable-diagnostics | optimizer | `sqlite_store/feed_geometry.rs` | row-height session maps | `commands_optimizer_test.rs`, `geometry_rows_test.rs` | feed consumption, Stats projection, and no-import proof |
| `retention.plan` | partial | retention | compaction | `RetentionPlanInput` | `RetentionPlanOutput` | `cache_ledger.compaction_candidates` | `cache_ledger` | `sqlite_cache_ledger_row`, `retention_candidate_from_ledger_row` | cache decode, pressure stop reasons, storage unavailable, timeout, blocked | ledger, recoverable-cache, derived-feed-cache, diagnostics-cache, metadata | reads-ledger | mixed | pressure | pure `lkjstr-storage/src/retention/` planner; worker call not wired | cache maintenance | `retention_test.rs`, `commands_retention_test.rs` | Rust retention parity plus no-import proof |
| `retention.delete-dispatch` | implemented | retention | compaction | `RetentionDeleteDispatchInput` | `RetentionDeleteDispatchOutput` | `events.delete`, `event_tags.delete_by_event`, `event_relays.delete_by_event`, `notifications.delete`, `feed_cursors.delete`, `feed_coverage.delete`, `feed_scan_hints.delete`, `relay_diagnostic_summaries.delete`, `relay_information.delete`, `relay_read_observations.delete`, `relay_read_scores.delete`, `relay_list_suggestions.delete`, `author_relay_routes.delete`, `route_evidence_scores.delete`, `jobs.delete`, `cache_ledger.delete` | `events`, `event_tags`, `event_relays`, `notifications`, `feed_cursors`, `feed_coverage`, `feed_scan_hints`, `relay_diagnostic_summaries`, `relay_information`, `relay_read_observations`, `relay_read_scores`, `relay_list_suggestions`, `author_relay_routes`, `route_evidence_scores`, `jobs`, `cache_ledger` | `sqlite_cache_ledger_row`, `retention_delete_intent` | write/quota, pressure stop reasons, storage unavailable, timeout, blocked | ledger, recoverable-cache, derived-feed-cache, diagnostics-cache | deletes-ledger-backed-rows | mixed | pressure | `sqlite_store/retention.rs`; pure steps in `retention_dispatch.rs` | cache maintenance | `commands_retention_test.rs`, `sqlite_retention_store_test.rs` | Rust retention product wiring plus no-import proof |

## Dispatch Cross-Reference

| Command id | Rust metadata file | SQL statement id | Manifest table | Row codec | Worker adapter function | TypeScript retained | Focused test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `retention.plan` | `crates/lkjstr-storage/src/commands/retention.rs` | `cache_ledger.compaction_candidates` | `cache_ledger` | `sqlite_cache_ledger_row`, `retention_candidate_from_ledger_row` | pure `retention_plan_output` | cache maintenance | `cargo test -p lkjstr-storage retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `event_tags.delete_by_event`, `event_relays.delete_by_event`, `events.delete`, `cache_ledger.delete` | `events`, `event_tags`, `event_relays`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | cache maintenance | `cargo test -p lkjstr-web retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `notifications.delete`, `cache_ledger.delete` | `notifications`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | notifications cache paths | `cargo test -p lkjstr-web retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `feed_cursors.delete`, `feed_coverage.delete`, `feed_scan_hints.delete`, `cache_ledger.delete` | `feed_cursors`, `feed_coverage`, `feed_scan_hints`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | feed cache paths | `cargo test -p lkjstr-web retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `relay_diagnostic_summaries.delete`, `relay_information.delete`, `cache_ledger.delete` | `relay_diagnostic_summaries`, `relay_information`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | relay diagnostic paths | `cargo test -p lkjstr-web retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `relay_read_observations.delete`, `relay_read_scores.delete`, `cache_ledger.delete` | `relay_read_observations`, `relay_read_scores`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | relay diagnostic paths | `cargo test -p lkjstr-web retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `relay_list_suggestions.delete`, `author_relay_routes.delete`, `route_evidence_scores.delete`, `cache_ledger.delete` | `relay_list_suggestions`, `author_relay_routes`, `route_evidence_scores`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | route evidence paths | `cargo test -p lkjstr-web retention` |
| `retention.delete-dispatch` | `crates/lkjstr-storage/src/commands/retention.rs` | `jobs.delete`, `cache_ledger.delete` | `jobs`, `cache_ledger` | `retention_delete_intent` | `sqlite_retention_delete_dispatch` | jobs cache paths | `cargo test -p lkjstr-web retention` |

## Stop Reasons

Retention reports one exact stop reason when pressure remains:
`no-prunable-candidates`, `protected-only`, `unknown-unowned-usage`,
`inventory-incomplete`, `quota-pressure`, `storage-api-unavailable`, or
`compaction-error`. Missing ledger ownership is not safe to prune. A plan that
reaches the byte target records target satisfaction separately from these
failure stop reasons.

## Source Steps

1. Read `cache_ledger` candidates with `cache_ledger.compaction_candidates`.
2. Convert each ledger row into a planner candidate only when the readiness
   classifier allows pressure-byte planning and the resource kind
   is ledger-backed and recoverable.
3. Sort by score, older update time, resource kind, and resource id.
4. Skip protected rows, unknown ownership, and dynamic protection pins.
5. Dispatch deletes by resource kind and delete the `cache_ledger` row in the
   same worker batch.
6. Re-read pressure after dispatch and report the exact stop reason when the
   target is still not satisfied.
