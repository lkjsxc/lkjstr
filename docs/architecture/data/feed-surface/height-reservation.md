# Feed Height Reservation

## Purpose

Feed rows reserve vertical height so enrichment, unloading, and level-of-detail
changes do not move the user's scroll anchor.

## Contract

Status: Rust is the authoritative pure reducer for reservation choices,
measurement invalidation, and anchor deltas. Svelte reports DOM observations and
applies returned reservations. Session TypeScript maps may cache bridge results
for responsiveness but are not the product geometry engine. Durable SQLite
observation/model persistence exists for Rust-owned rows, and Home cached rows
consume matching models first. Full Leptos feed use remains an active target.

Measured height is a **structural reservation** for the visual row at the
matching geometry key and layout bucket. A reservation is part of the scroll
state, not just CSS `min-height` and not an implementation detail of the
materialized DOM.

Required behavior:

- Every visual row has a semantic row key and visual row key from real row
  identity, fragment kind, fragment index, and content shape.
- Measurement keys include width bucket, font scale bucket, density bucket, and
  geometry schema generation.
- Rows reserve an estimated or measured height before profile, reference, media,
  action, reaction, nested repost, and emoji enrichment finishes.
- Predictions come from real measurements or deterministic features, never fake
  content.
- Visible and near-visible rows render real content, real loading states, or real
  unavailable states.
- Far rows may use cheap DOM, shells, or LOD blocks, but they keep the reserved
  structural block height.
- Profile chips, reference previews, nested repost targets, media, custom emoji,
  and action or reaction summaries each have deterministic tiered reservation
  behavior before asynchronous resolution completes.
- Dematerialization emits `row_unloaded`; remount emits `row_rematerialized`.
  Neither event may shrink the preserved structural reservation. Enrichment-only
  height may collapse per [enrichment-height-tiers.md](enrichment-height-tiers.md).
- Height may shrink only after explicit remeasurement caused by a legitimate
  layout or content condition.
- Height changes above the viewport preserve the current anchor by applying the
  measured scroll delta.

Detailed unload rules live in
[unload-height-stability.md](unload-height-stability.md).

## Legitimate Remeasurement

A reservation may be replaced by a smaller or larger value when one of these
changes:

- pane width or split-pane size changes the width bucket.
- font scale, device pixel ratio, or density changes its bucket.
- the semantic row renders a different event or row identity.
- the content shape hash changes because real content, known media dimensions,
  reference resolution state, nested repost state, action or reaction summary
  state, or media availability changed.
- the geometry schema generation changes.
- a measurement expires and the row falls back to a marked estimate.

Unloading is not a legitimate remeasurement reason.

## Width Buckets

Measurements are scoped to stable coarse width buckets:

```text
0-319
320-479
480-639
640-799
800-1023
1024+
```

A height measured in one bucket must not remain a permanent minimum height after
the tile crosses into another bucket. When the bucket changes, old height data is
inactive for the current row. The row uses a matching observation, a new
estimate, or a conservative fallback until recomputation and materialized
remeasurement in the new bucket allow shrink or growth.

## Features

Geometry models bucket only durable, generalizable data:

```text
row kind
event kind
content length
Unicode scalar count
line break count
longest unbroken token length
URL count
media count
reference preview count
custom emoji count
profile summary flag
notification chrome flag
action bar flag
width bucket
font scale bucket
density bucket
content shape hash
materialization tier
reference resolution state
media resolution state
nested repost state
action or reaction summary state
measurement generation
```

Tab ids, pane ids, owner handles, request ids, current scroll offset, and relay
socket ids are not geometry keys.

## Measurement Loop

1. Build row features before rendering enrichment.
2. Ask Rust/WASM for an estimated height and confidence when available.
3. Apply the active reserved height to the outer row wrapper.
4. Observe materialized row content height and inline size with
   `ResizeObserver` inside the reserved wrapper. Do not record the wrapper
   `min-height` gap as content height.
5. Record measurements only when the row is materialized in the current layout
   bucket.
6. Preserve the previous reservation when the row unloads or dematerializes.
7. Recompute the reservation when an allowed remeasurement trigger occurs.
8. If the row is above the viewport, compensate scroll by the height delta.
9. Persist bounded observations through typed `feed_row_height_observations`
   and `feed_row_height_models` SQLite worker statements.
10. Load matching model rows into converted feed hosts before estimating rows;
    Home cached rows are first, and broader host coverage remains open.
11. Expose aggregate reservation counts in Stats.

## Media And Previews

- Known media aspect ratios reserve bounded media slots before load.
- Unknown media reserves a conservative bounded slot and updates after real
  dimensions are known.
- Reference previews and profile cards reserve bounded preview heights before
  hydration.
- Compact unavailable states are real states and may have their own measured
  reservations.
- Content remains accessible; do not hide real content only to freeze height.

## Verification

- Event, repost target, profile card, notification, reference, media, log, and
  tool rows do not shrink merely because they unload or dematerialize.
- Overestimated reference or repost reservations shrink after real materialized
  content is measured, with above-viewport anchor compensation.
- Shells preserve the prior reserved block height.
- Rows may shrink after width, font, density, content shape, or schema
  generation changes and materialized remeasurement.
- Late profile, reference, and media hydration above the viewport preserve the
  visible anchor.
- Split-pane resize recomputes width-bucket estimates and can shrink rows.
- Widening after a narrow measurement does not keep stale excess height.
- Height observations stay bounded in memory and storage.
- Each feed tab still has exactly one primary `[data-scroll-owner]`.
