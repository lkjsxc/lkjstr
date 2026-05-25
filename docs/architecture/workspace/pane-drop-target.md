# Pane Drop Target

## Purpose

Pane drop targeting resolves where a dragged tab will land and what overlay the
user sees.

## Drop Surface

- Drop resolution uses the full pane tile rectangle: tab header plus body.
- The shared resolver returns zone, insertion index, and overlay style for both
  pointer and native drag paths.
- `PaneDropLayer` renders feedback from resolver output; it is not the sole
  owner of zone math.

## Hit Detection

- Edge activation uses `tabDropHitSize(dimension)`: about 22% of the pane width
  or height, clamped between 44 and 96 pixels.
- Values outside edge corridors map to `center`.
- Center hit testing still uses tab frame positions for insertion index.

## Preview Overlays

- Preview geometry is separate from hit corridors.
- `center` preview covers the full pane tile.
- Edge previews cover exactly half the pane along the chosen edge (left, right,
  top, or bottom).
- Overlay CSS variables come from `tabDropPreviewRect`, not from hit corridor
  sizes.

## Zones

| Zone | Commit | Preview |
| ---- | ------ | ------- |
| `center` | Move or reorder in target group | Full pane |
| `left` / `right` / `top` / `bottom` | Smart split at edge | Half pane on that edge |

## Native Parity

- Native `dragover` on the pane tile feeds the same resolver as pointer move
  events.
- Native `drop` uses the resolver insertion index, not an unconditional append.
