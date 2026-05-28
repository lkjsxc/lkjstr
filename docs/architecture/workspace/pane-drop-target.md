# Pane Drop Target

## Purpose

Pane drop targeting resolves where a dragged tab will land and what overlay the
user sees.

## Chrome vs Body

See [pane-chrome-scope.md](pane-chrome-scope.md). Summary:

- `clientY <= chromeBottom` always resolves `center`.
- Edge hit detection uses `bodyRect` (`.pane-stack`) only.
- Edge previews align with `bodyRect`, offset by `bodyOffsetTop` inside the
  full-pane drop layer.

## Hit Detection

- Edge activation uses `tabDropHitSize(dimension)`: about 28% of the pane body
  width or height, clamped between 56 and 128 pixels when space allows, and
  capped below half the dimension so the center corridor remains reachable.
- Pointers above `bodyRect.top` outside chrome resolve `center`, not `top`.
- Center hit testing uses tab frame positions for insertion index when over
  chrome or the body center corridor.

## Preview Overlays

- Preview geometry is separate from hit corridors.
- All previews use **pane body** dimensions and `bodyOffsetTop`.
- `center` preview covers the full body (reorder or move into group).
- Edge previews cover exactly half the pane body along the chosen edge.
  CSS variables include `bodyOffsetTop` so the highlight does not sit under the
  tab strip.
- Overlay variables come from `tabDropPreviewRect` plus offset, not from hit
  corridor sizes alone.

## Zones

| Zone                                | Commit                          | Preview                |
| ----------------------------------- | ------------------------------- | ---------------------- |
| `center`                            | Move or reorder in target group | Full body highlight    |
| `left` / `right` / `top` / `bottom` | Smart split at edge             | Half body on that edge |

## Native Parity

- Native `dragover` on the pane tile feeds the same resolver as pointer move
  events.
- Native `drop` uses the resolver insertion index, not an unconditional append.

## Related

- [tab-dragging.md](tab-dragging.md): drag snapshot and capture.
- [workspace-layout-tree.md](workspace-layout-tree.md): smart split insertion.
