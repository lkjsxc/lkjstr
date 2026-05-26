# Pane Drop Target

## Purpose

Pane drop targeting resolves where a dragged tab will land and what overlay the
user sees.

## Drop Surface

- Edge split hit detection uses the **pane body** rectangle only. The tab strip
  is excluded from edge-zone geometry.
- Center insert hit detection uses tab frame positions within the tab strip when
  the pointer is over the strip band.
- `PaneDropLayer` renders feedback from resolver output; it is not the sole
  owner of zone math.

## Hit Detection

- Edge activation uses `tabDropHitSize(dimension)`: about 22% of the pane body
  width or height, clamped between 44 and 96 pixels.
- Values outside body edge corridors map to `center` when over the tab strip, or
  to the nearest edge when over the body.
- Center hit testing uses tab frame positions for insertion index.

## Preview Overlays

- Preview geometry is separate from hit corridors.
- `center` preview covers the tab strip and body when inserting into the group.
- Edge previews cover exactly half the **pane body** along the chosen edge
  (left, right, top, or bottom). The tab strip is not included in edge preview
  geometry.
- Overlay CSS variables come from `tabDropPreviewRect`, not from hit corridor
  sizes.

## Zones

| Zone                                | Commit                          | Preview                |
| ----------------------------------- | ------------------------------- | ---------------------- |
| `center`                            | Move or reorder in target group | Strip + body highlight |
| `left` / `right` / `top` / `bottom` | Smart split at edge             | Half body on that edge |

## Native Parity

- Native `dragover` on the pane tile feeds the same resolver as pointer move
  events.
- Native `drop` uses the resolver insertion index, not an unconditional append.
