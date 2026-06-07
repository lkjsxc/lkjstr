# Enrichment Height Tiers

## Purpose

Enrichment height tiers make asynchronous row content predictable. They reserve
real structural space before references, media, repost targets, profiles,
custom emoji, and action summaries resolve, without creating fake event content.

## Tiers

### Structural Tier

- Real row identity, author chrome, event text, base action bar, and bounded
  slots for known height-affecting children.
- Preserved across virtualizer unload, dematerialization, hidden-tab pause, and
  remount.
- May shrink only after a legitimate invalidation and materialized
  remeasurement in the active width, font, and density bucket.

### Loading Tier

- A real loading state for a known reference, repost target, profile chip,
  media item, custom emoji, or action summary.
- Reserves the deterministic bounded slot chosen by the Rust geometry reducer.
- May increase structural reservation when known tags or metadata prove that the
  loading child exists.

### Resolved Compact Tier

- A resolved real event, profile, media, or summary rendered in compact form.
- Used for reference cards, unavailable target context, small media, and summary
  rows that do not need expanded detail.
- May increase reservation if compact real content exceeds the loading slot.

### Resolved Expanded Tier

- A resolved real child in expanded form, such as a nested repost card, media
  with known dimensions, or opened action/reaction detail.
- May increase reservation while materialized.
- Expanded-only height may collapse back to structural, loading, compact, or
  shell estimates when the row deliberately drops materialization tier.

### Unavailable Tier

- A compact real unavailable state for a missing or failed reference, repost
  target, media item, or profile.
- It is not fake preview content.
- It may shrink from loading or expanded only after the reducer records the
  unavailable state as a content-shape change or tier change.

## Transitions

Allowed increases:

- Structural to loading when real metadata proves an enrichment child exists.
- Loading to compact or expanded when resolved content exceeds the reserved slot.
- Compact to expanded when the user or materialization policy opens more real
  detail.

Allowed shrinks:

- Width, font, density, content-shape, schema-generation, or measurement-expiry
  invalidation followed by recomputation.
- Expanded to compact, loading, unavailable, structural, or shell when the
  materialization tier intentionally drops.
- Loading to unavailable after the real unavailable state is known.

Forbidden shrinks:

- Virtualizer unload or remount of the same row.
- Hidden-tab pause.
- Replacing real structural content with shorter placeholder DOM.
- Reusing a measurement from another width bucket as the current minimum.

## Shape Inputs

The content-shape hash and persisted observation key include the materialization
tier plus reference resolution, media resolution, nested repost, and
action/reaction summary states. They exclude tab id, pane id, request id, relay
socket id, owner handle, and current scroll offset.

## Related

- [height-reservation.md](height-reservation.md).
- [unload-height-stability.md](unload-height-stability.md).
- [geometry-model.md](geometry-model.md).
