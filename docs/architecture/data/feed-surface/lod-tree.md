# Feed LOD Tree

## Purpose

The feed level-of-detail tree indexes real feed rows so heavy feeds can keep
stable scroll math without materializing every enriched row.

## Data Model

The tree indexes flattened feed rows with real metadata:

```text
row id or event id
row kind
timestamp
estimated height
measured height when available
loaded state
coverage state
route group
relay provenance count
media flag
preview flag
reply child count
```

It never creates fake event content. Missing coverage is represented as real
unavailable or uncovered state only where the UI already supports such rows.

## Shape

- Leaf: one real row.
- Block: 16 to 64 rows with cumulative height, time range, loaded count, and
  dense or unresolved markers.
- Superblock: larger cumulative ranges for fast offset-to-row mapping.

## Operations

```text
build_lod_tree(rows, geometry_models)
offset_to_row(tree, scroll_offset)
visible_range(tree, scroll_offset, viewport_height, overscan)
materialization_plan(tree, visible_range)
height_delta_update(tree, row_id, measured_height)
coverage_gap_projection(tree)
```

## Rendering Rules

- Visible rows render full real rows.
- Near-visible rows render full row shells and schedule enrichment first.
- Mid-distance rows render real shells with reserved height and no heavy
  previews until near-visible.
- Far rows use block-level real metadata for virtualizer math and optional
  compact timeline overview.
- Live prepends and older appends update cumulative heights without changing the
  current visible anchor unless the user is intentionally at the top.

## Consumers

The tree informs scrollbar stability, prefetch windows, hydration priority,
cache retention priority, row geometry updates, scan planning diagnostics, and
Stats feed-density or coverage displays.

## Verification

- Offset-to-row mapping stays correct after height updates.
- Live prepends preserve anchor when the user is not at the top.
- Older loads append blocks without changing the current anchor.
- Missing parent replies can remain roots until the parent arrives.
- Dense blocks trigger planning diagnostics without proving absence.
- Heavy-feed tests prove the virtualizer does not materialize all rows.
