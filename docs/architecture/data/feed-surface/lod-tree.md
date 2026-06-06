# Feed LOD Tree

## Purpose

The feed level-of-detail tree indexes real feed rows so heavy feeds keep stable
scroll math while low-value branches degrade to compact recoverable summaries.

## Materialization Levels

| Level | Data kept |
| --- | --- |
| `full` | event row, normalized event, relay provenance, parsed content, profiles, references, previews, media layout, measured height, and UI row model |
| `shell` | event id, kind, pubkey, timestamp, estimated height, measured height when known, provenance count, media flags, reply or quote flags, and coverage state |
| `block` | time range, count, cumulative height, loaded count, route group, coverage state, density marker, score range, structural hints, and recovery recipe id |
| `recovery` | semantic feed key, route fingerprint, selected-relay fallback set, route-evidence relays, filter shape, time interval, scan hints, coverage status, and geometry model |
| `absent` | no durable row data and no user-visible recovery value |

The tree never creates fake events or fake previews. Missing data is uncovered,
compacted, unavailable, or recovering. Dematerializing a branch preserves the
previous reserved height for the matching geometry bucket until an allowed
remeasurement invalidates it.

## Storage Tables

The worker-owned SQLite manifest owns these records:

```text
feed_lod_nodes
feed_lod_recovery_recipes
feed_lod_materialization
feed_interval_coverage
feed_geometry_models
cache_retention_traces
```

Main-thread product code calls typed repositories. It must not open SQLite or
OPFS directly. Schema changes are recorded in the Rust storage manifest before
TypeScript callers depend on them.

## Shape

- Leaf: one real row.
- Block: 16 to 64 rows with cumulative height, time range, loaded count,
  coverage state, and dense or unresolved markers.
- Superblock: larger cumulative ranges for fast offset-to-row mapping.

## Operations

```text
build_lod_tree(rows, geometry_models)
offset_to_row(tree, scroll_offset)
visible_range(tree, scroll_offset, viewport_height, overscan)
materialization_plan(tree, visible_range)
forgetting_plan(tree, retention_scores, byte_pressure)
recovery_recipe(tree, compacted_range)
height_delta_update(tree, row_id, measured_height)
coverage_gap_projection(tree)
```

## Retention Actions

Low-value branches degrade in order:

1. `full` to `shell`: drop profiles, previews, parsed token arrays, recomputable
   media dimensions, and rendered row view models.
2. `shell` to `block`: keep cumulative geometry, event ids when affordable,
   time ranges, coverage state, density markers, and recovery recipe id.
3. `block` to `recovery`: keep enough information to request from SQLite or
   relays again.
4. `recovery` to `absent` only when no durable value or user-visible state
   depends on the branch.

Ordinary event compaction must not globally delete feed coverage or scan hints.
It degrades only intervals whose supporting materialization changed and records
the retained recovery path.

## Protection

Hard protection covers visible viewport and overscan, focused tab, active Thread
root and ancestors, active Profile header and visible posts, unread recent
notifications, active drafts, runtime-pinned events, latest metadata, active
follow lists, open Followees targets, open User Timeline targets, and user-owned
protected storage.

## Recovery Path

When the user navigates to a compacted branch:

1. Ask SQLite for full or shell rows in the interval.
2. If SQLite coverage is complete, materialize from SQLite.
3. If SQLite is partial, render cached shells and schedule relay work for
   uncovered intervals.
4. Use route evidence, selected relay fallback, NIP-65 hints, relay provenance,
   and scan density hints to plan reads.
5. Do not prove absence unless interval-union coverage is complete for required
   relays, route groups, semantic key, filter key, and interval.
6. Persist recovered rows through normal event repositories and cache ledger.
7. Update geometry and retention scores.

## Verification

- Offset-to-row mapping stays correct after height updates.
- Older loads append blocks without changing the current anchor.
- Far branches can degrade without losing scroll height.
- Shell and block rows preserve measured reservations after unload.
- Compacted branches have real recovery recipes.
- Rehydration checks SQLite first and relays only for uncovered intervals.
- Relay reacquisition does not prove absence from incomplete coverage.
