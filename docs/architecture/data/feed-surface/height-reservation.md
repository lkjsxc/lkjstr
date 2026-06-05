# Feed Height Reservation

## Purpose

Feed rows reserve vertical height before enrichment so profile metadata,
reference previews, and media dimensions do not visibly move the user's anchor.

## Contract

Status: the shipped Svelte scroll surface applies session-measured reservation
and compensates height changes above the viewport. Rust/WASM feature estimates
and SQLite persistence remain the durable target.

- Every row has a stable geometry key from real row identity and content shape.
- Measurement keys include row key, row kind, content shape hash, and width
  bucket.
- Rows reserve a predicted height before profile, reference, media, and action
  enrichment finishes.
- Predictions come from real measured rows and stable features, not fake
  content.
- Visible and near-visible rows render full real content.
- Far rows may use shells and predicted heights, but they still represent real
  row ids and coverage states.
- Height changes above the viewport preserve the current anchor by applying the
  measured scroll delta.

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
the tile crosses into another bucket. When the bucket changes, the row resets to
the estimate for the new bucket or to a conservative fallback until measured.

## Features

Geometry models bucket only durable, generalizable data:

```text
row kind
content length
line break count
url count
media count
reference preview flag
profile summary flag
notification chrome flag
action bar flag
width bucket
font scale bucket
```

Tab ids, pane ids, owner handles, and request ids are not geometry keys.

## Measurement Loop

1. Build row features before rendering enrichment.
2. Ask Rust/WASM for an estimated height and confidence when available.
3. Apply a virtualizer estimate or temporary reserved minimum height.
4. Observe row height and inline size with `ResizeObserver`.
5. Recompute reservation when the width bucket changes.
6. If the row is above the viewport, compensate scroll by the height delta.
7. Persist observations through the SQLite worker when the durable geometry
   repository is wired.
8. Update the model and expose counts in Stats.

## Media And Previews

- Known media aspect ratios reserve bounded media slots before load.
- Unknown media reserves a conservative bounded slot and updates after load.
- Reference previews and profile cards reserve bounded preview heights before
  hydration.
- Content remains accessible; do not hide real content only to freeze height.

## Verification

- Profile hydration above the viewport preserves the visible anchor.
- Reference preview hydration above the viewport preserves the visible anchor.
- Media dimension changes above the viewport preserve the visible anchor.
- Split-pane resize recomputes width-bucket estimates and can shrink rows.
- Widening after a narrow measurement does not keep stale excess height.
- Height observations stay bounded in memory and improve estimates.
