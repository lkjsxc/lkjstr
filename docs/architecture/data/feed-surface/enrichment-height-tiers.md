# Enrichment Height Tiers

## Purpose

Enrichment height tiers separate structural row height from optional enrichment
height so virtualized feeds stay scroll-stable without leaving large empty gaps
after dematerialization.

## Tiers

### Shell

- Cheap placeholder DOM for a real row id.
- Uses deterministic feature estimates only.
- No resolved reference cards, hydrated profile blocks, or expanded action
  panels.

### Structural

- Real event text, action bar, loading reference shells, and bounded preview
  slots.
- Preserved across unload and dematerialization.

### Enriched

- Resolved reference cards, hydrated profile metadata blocks, expanded reply or
  zap panels, and measured media layout.
- May collapse back to structural or shell tier on dematerialization.

## Reservation Rule

When `materializationTier` drops from `enriched` to `structural` or `shell`, the
reservation may shrink to the tier estimate for the current content shape hash.
The scroll owner applies anchor compensation when the shrink happens above the
viewport.

When tier stays `structural` or rises to `enriched`, normal unload preservation
rules from [unload-height-stability.md](unload-height-stability.md) apply.

## Content Shape Hash

The shape hash includes:

- tag-derived reference counts
- reference resolution state: `pending`, `resolved`, `unavailable`
- `materializationTier`
- row kind, including `user-row` for Followees entries

A tier drop is a legitimate remeasurement trigger.

## Row Kinds

- `user-row`: Followees and identity list rows use a dedicated base height.
- `event`, `thread-root`, `notification`, `leading`, `footer`: unchanged
  families.
- `eventFragment`: fragment rows keep fragment index in the visual row key.

## Implementation

The shipped Svelte feed tracks materialized row keys in
`row-height-reservation.ts`. Visible rows estimate at the `enriched` tier;
dematerialized rows fall back to `structural` tier estimates. Enrichment
collapse returns reference preview blocks to structural shell height instead of
keeping full measured enriched height.

## Measurement Key Fix

Quote and reply reference cards left excessive offscreen spacing when enriched
DOM measurements were reused after dematerialization.

Required fix in `row-height-reservation-keys.ts`:

1. Include `materializationTier` in `measurementKeyFromFeatures`.
2. Reject enriched measurements when estimating structural or shell tiers.
3. On `markFeedRowDematerialized`, allow reservation shrink to the structural
   tier estimate even when the content shape hash is unchanged.

Closing gate: `tests/unit/feed-surface/row-height-reservation-tier.test.ts`.

## Known Gap

Reply and zap inline panels that expand while a row is visible may still need a
stronger action-state bit in the shape hash if expanded height differs greatly
from the action-bar estimate.

Reproduction:

1. Open a feed with reply or zap inline panels available.
2. Expand reply or zap on a visible row.
3. Scroll the row offscreen and back.
4. If reserved height stays at the expanded panel size after dematerialization,
   record the event kind, panel mode, and measured heights here before adding an
   action-state machine.

## Related

- [unload-height-stability.md](unload-height-stability.md).
- [height-reservation.md](height-reservation.md).
- [geometry-model.md](geometry-model.md).
