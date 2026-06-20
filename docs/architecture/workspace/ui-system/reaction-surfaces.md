# Reaction Surfaces

## Purpose

Reaction surfaces split emoji picking from reaction summary display so event
rows stay compact and popovers survive virtual list recycling.

## Emoji Picker

- Canonical entry: `EmojiPaletteButton`.
- Wraps `AnchoredPopover` and `EmojiPopover`.
- Used on event action bars and Tweet compose toolbars.
- Popover portals to the tile host so virtua dematerialization does not destroy
  it while open.
- Open state must not change row height.

## Reaction Summary

- `ReactionSummary` shows grouped reaction chips and repost counts.
- Chip click expands an inline actor list under the chip.
- Chip disclosure labels are count-aware and state-aware, for example show vs
  hide labels for the current reaction or repost count.
- Actor list expansion is not the emoji picker; it does not publish reactions.
- Expanded actor lists may affect row height while visible; they are not part of
  the tile-scoped popover contract.

## Event Action Bar

Inline icon buttons in order:

1. Heart
2. Repost
3. Reply
4. Zap
5. Emoji palette

Reply and zap modes render inline panels below the action bar. Expanded panel
height is a known enrichment-tier gap documented in
[enrichment-height-tiers.md](../../data/feed-surface/enrichment-height-tiers.md).

## Placement

- Picker popovers use tile-scoped bounds from `[data-pane-id]`.
- Preferred placement is `bottom-start` for event rows.
- Popover stays hidden until the first position pass completes.

## Related

- [emoji-palette.md](emoji-palette.md).
- [../tile-overlays.md](../tile-overlays.md).
- [../../../product/tools/event-actions.md](../../../product/tools/event-actions.md).
