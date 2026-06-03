# Feed Height Reservation

## Purpose

Feed rows reserve vertical height before enrichment so profile metadata,
reference previews, and media dimensions do not visibly move the user's anchor.

## Contract

Status: the shipped Svelte scroll surface applies session-measured min-height
reservation and compensates height changes above the viewport. Rust/WASM
feature estimates and SQLite persistence remain the target durable path.

- Every row has a stable geometry key derived from real row identity and stable
  content features.
- Rows reserve a predicted height before profile, reference, media, and action
  enrichment finishes.
- Predictions come from real measured rows and stable features, not fake
  content.
- Visible and near-visible rows render full real content.
- Far rows may use shells and predicted heights, but they still represent real
  row ids and coverage states.
- Height changes above the viewport preserve the current anchor by applying the
  measured scroll delta.

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
2. Ask Rust/WASM for an estimated height and confidence.
3. Apply a reserved min-height or virtualizer estimate.
4. Measure materialized rows with `ResizeObserver`.
5. If the row is above the viewport, compensate scroll by the height delta.
6. Persist observations through the SQLite worker when the durable geometry
   repository is wired.
7. Update the model and expose counts in Stats.

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
- Split-pane resize recomputes estimates and keeps the closest stable anchor.
- Height observations persist across reload and improve estimates.
