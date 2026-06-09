# Retention Commands

## Purpose

Retention command metadata tracks pressure snapshots, cache ledger reads, delete
dispatch, optimizer rows, and Stats inventory. Retention must delete only
ledger-backed prunable rows and must report exact stop reasons.

## Current Next Edit

1. Implement retention planning and delete-dispatch command coverage.
2. Add tests proving command ids, statements, tables, row codecs, problem kinds,
   ledger policy, protection policy, and Stats projection.
3. Only after retention metadata passes, implement conservative repair commands.

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
| `retention.plan` | not implemented | retention | compaction | open | open | cache ledger selector open | `cache_ledger` | ledger row codecs exist | pressure stop reasons | ledger | reads-ledger | mixed | pressure | cache maintenance | retention tests | Rust retention parity plus no-import proof |
| `retention.delete-dispatch` | not implemented | retention | compaction | open | open | table delete dispatch open | prunable manifest tables | table codecs exist | write/quota, pressure stop reasons | recoverable cache classes | deletes-ledger-backed-rows | recoverable-cache | pressure | cache maintenance | retention tests | Rust retention parity plus no-import proof |

## Stop Reasons

Retention reports one exact stop reason: `no-prunable-candidates`,
`protected-only`, `unknown-unowned-usage`, `inventory-incomplete`,
`quota-pressure`, `storage-api-unavailable`, or `compaction-error`. Missing
ledger ownership is not safe to prune.
