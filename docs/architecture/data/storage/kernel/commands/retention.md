# Retention Commands

## Purpose

Retention command metadata tracks pressure snapshots, cache ledger reads, delete
dispatch, optimizer rows, and Stats inventory. Retention must delete only
ledger-backed prunable rows and must report exact stop reasons.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `storage-pressure.get` | implemented | pressure | read | `StoragePressureGetInput` | `StoragePressureGetOutput` | `cache_meta.select` | `cache_meta` | `storage_pressure_from_sqlite_row` | pressure decode | metadata | none | recoverable-diagnostics | pressure | `sqlite_store/pressure.rs` | cache repositories | `commands_diagnostics_test.rs` | Rust Stats parity plus no-import proof |
| `storage-pressure.put` | implemented | pressure | write | `StoragePressurePutInput` | `StoragePressurePutOutput` | `cache_meta.upsert` | `cache_meta` | `sqlite_storage_pressure_snapshot_row` | pressure decode, write/quota | metadata | none | recoverable-diagnostics | pressure | `sqlite_store/pressure.rs` | cache repositories | `commands_diagnostics_test.rs` | Rust Stats parity plus no-import proof |
| `storage-pressure.project-stats` | implemented | pressure | inventory | `StoragePressureProjectInput` | `StoragePressureProjectOutput` | `cache_meta.select` | `cache_meta` | `storage_pressure_from_sqlite_row` | pressure decode | metadata | none | recoverable-diagnostics | pressure | `lkjstr-storage/src/stats.rs` | cache repositories | `commands_diagnostics_test.rs` | Rust Stats parity plus no-import proof |
| `storage-inventory.snapshot` | implemented | inventory | inventory | `StorageInventorySnapshotInput` | `StorageInventorySnapshotOutput` | inventory-only generated count SQL | inventory-only | `storage_stats_snapshot_from_sqlite_counts` | storage unavailable, timeout, blocked, corrupt | metadata | none | inventory-only | inventory | `sqlite_store/inventory.rs` | cache repositories | command inventory | Rust Stats parity plus no-import proof |
| `optimizer.feed-scan-observation.insert` | partial | optimizer | write | open | open | `feed_scan_observations.insert` | `feed_scan_observations` | optimizer row codecs exist | cache decode, write/quota | diagnostics-cache | open | recoverable-diagnostics | optimizer | `scan_model/**` | `optimizer` tests | Rust optimizer parity plus no-import proof |
| `optimizer.feed-scan-density-model.select-context` | partial | optimizer | read | open | open | `feed_scan_density_models.select_context` | `feed_scan_density_models` | optimizer row codecs exist | cache decode | diagnostics-cache | open | recoverable-diagnostics | optimizer | `scan_model/**` | `optimizer` tests | Rust optimizer parity plus no-import proof |
| `optimizer.feed-scan-density-model.upsert` | partial | optimizer | write | open | open | `feed_scan_density_models.upsert` | `feed_scan_density_models` | optimizer row codecs exist | cache decode, write/quota | diagnostics-cache | open | recoverable-diagnostics | optimizer | `scan_model/**` | `optimizer` tests | Rust optimizer parity plus no-import proof |
| `optimizer.feed-scan-decision-trace.insert` | partial | optimizer | write | open | open | `feed_scan_decision_traces.insert` | `feed_scan_decision_traces` | optimizer row codecs exist | cache decode, write/quota | diagnostics-cache | open | recoverable-diagnostics | optimizer | `scan_model/**` | `optimizer` tests | Rust optimizer parity plus no-import proof |
| `retention.plan` | not implemented | retention | compaction | open | open | cache ledger selector open | `cache_ledger` | ledger row codecs exist | pressure stop reasons | ledger | reads-ledger | mixed | pressure | cache maintenance | retention tests | Rust retention parity plus no-import proof |
| `retention.delete-dispatch` | not implemented | retention | compaction | open | open | table delete dispatch open | prunable manifest tables | table codecs exist | write/quota, pressure stop reasons | recoverable cache classes | deletes-ledger-backed-rows | recoverable-cache | pressure | cache maintenance | retention tests | Rust retention parity plus no-import proof |

## Stop Reasons

Retention reports one exact stop reason: `no-prunable-candidates`,
`protected-only`, `unknown-unowned-usage`, `inventory-incomplete`,
`quota-pressure`, `storage-api-unavailable`, or `compaction-error`. Missing
ledger ownership is not safe to prune.
