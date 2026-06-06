# Unload Height Stability

## Purpose

This contract prevents scroll jumps when a row leaves the active viewport and
switches to cheaper rendering. It applies to event rows, repost targets, quote
and reference cards, profile cards, notification rows, public chat rows, logs,
tool rows, and any other vertically scrolling row-like surface.

## Terms

- **Unload**: release expensive row effects, subscriptions, observers, media,
  preview hydration, profile hydration, or action state while keeping the row in
  the scroll model.
- **Dematerialize**: replace full row DOM with cheaper DOM, a shell, or a LOD
  block that still represents real data or a real unavailable state.
- **Reserved height**: the block height the scroll surface keeps for a visual
  row after an estimate or real measurement at a layout bucket.
- **Materialized row**: a visible or near-visible row rendering real content and
  eligible for measurement.
- **Shell**: cheap DOM for a real row id, known unavailable state, or recovery
  recipe. A shell is not fake event content.

## Stability Rule

A row that has been measured for the current geometry key and layout bucket must
not reserve less height merely because it unloads, dematerializes, loses
enrichment, or renders a lighter shell.

Allowed height changes:

- A materialized row is measured in the current width, font, and density bucket.
- Pane width, split size, font scale, density, device pixel ratio, or schema
  generation changes.
- Row content identity changes, such as rendering a different event.
- Content shape changes because real event content, known media dimensions, or a
  known reference preview state changed.
- A measurement expires and the surface explicitly falls back to an estimate
  marked stale or degraded.

Forbidden height changes:

- Unloading a row reduces its reserved height.
- Dropping profile metadata, media DOM, action controls, reference previews, or
  custom emoji reduces a reservation.
- Replacing real content with a shell collapses the row block.
- Cache miss or missing enrichment creates shorter fake content.
- Hidden tab demand release rewrites row identity or row height.

## Virtualized Rows

Virtualized rows keep a reservation outside the expensive content tree. The
reservation key is the visual row key plus layout buckets and content shape.
When the virtualizer unmounts row content, the retained size remains the last
valid reservation for that key and bucket.

Far rows may render cheap shells inside the reserved block. Visible and
near-visible rows must render real content, real unavailable states, or real
loading states while discovery is active.

## Anchor Compensation

Height changes above the viewport caused by allowed remeasurement apply this
scroll compensation:

```text
scroll_delta = sum(new_reserved_height - old_reserved_height)
```

The scroll owner applies the delta once. If unload preserves height, no
compensation should be needed because the scroll model did not change.

If the anchor row itself changes size, preserve the offset inside that row. If
that row no longer exists, choose the nearest surviving row and mark the anchor
confidence degraded.

## Stale Measurements

Measurements are ignored when any of these change:

- geometry schema generation.
- semantic row key or visual row key.
- content shape hash.
- width bucket.
- font scale bucket.
- density bucket.
- row family no longer produced by the planner.

Old measurements may remain stored for other buckets until retention removes
them, but they are inactive for the current row.

## LOD Blocks

A LOD shell or block stores cumulative reserved height for real rows or real
recovery intervals. Degrading from full to shell, shell to block, or block to
recovery keeps the cumulative height until a legitimate remeasurement or
schema-generation change invalidates it.

## Diagnostics

Stats exposes bounded counters:

- measured row reservations by surface family.
- unload-preserved rows.
- dematerialized rows that kept reservation.
- allowed shrink after remeasurement.
- anchor compensations applied.
- stale geometry observations ignored.
- geometry repository rows retained and evicted.

Diagnostics are aggregate and bounded. They do not list unbounded event ids.

## Related

- [height-reservation.md](height-reservation.md): concise row reservation loop.
- [geometry-model.md](geometry-model.md): keys, buckets, and persistence target.
- [lod-tree.md](lod-tree.md): shell and block retention.
- [feed-scroll-surface.md](feed-scroll-surface.md): one scroll owner per feed.
