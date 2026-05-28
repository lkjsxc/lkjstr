# Tile Overlays

## Purpose

Tile overlays define anchored UI that must stay inside a pane tile.

## Contract

- The emoji picker renders in a tile-scoped layer anchored to the triggering
  control.
- Popover position is clamped to the pane content rectangle, not the browser
  viewport.
- When there is insufficient space below the anchor, the picker flips above while
  remaining inside the tile bounds.
- Overlays use `position: fixed` with coordinates derived from the pane content
  box so they are not clipped by intermediate overflow containers incorrectly.
- Emoji picker open state does not change event row height.

## Related

- [../product/tools/event-actions.md](../../product/tools/event-actions.md)
- Custom emoji protocol: [../../protocol/custom-emoji.md](../../protocol/custom-emoji.md)
