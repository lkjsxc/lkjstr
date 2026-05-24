# Tab Dragging

## Purpose

Tab dragging owns tab movement feedback and commits across pointer and native
desktop drag input.

## Contract

- Pointer dragging is canonical for mouse, pen, and touch-like input.
- A drag snapshot records source pane id, tab id, pointer id, start point,
  latest point, active state, target pane id, target insertion index, and drop
  zone.
- Pointer capture is requested on pointer down, and window move, up, and cancel
  listeners keep the drag reliable when the pointer leaves the tab strip.
- Drag ghosts never block hit testing.
- Pane lookup ignores the ghost and resolves the closest `[data-pane-id]`.
- Drop zones are calculated by the pure `tab-drop-zone` helper.
- Edge thresholds are clamped so small panes remain usable and large panes do
  not make edge drops too large.
- The shared zone values are `center`, `left`, `right`, `top`, and `bottom`.
- Center drops insert into the target pane tab group using the target tab
  frames. Same-pane pointer reorders compute the insertion index after removing
  the dragged tab; cross-pane center drops append when the pointer is beyond the
  last target frame.
- Edge drops create a split at the target pane edge.
- Native drag-over, pointer drag-over, and rendered overlays use the same zone
  contract.
- Center feedback covers the whole pane body. Edge feedback renders a matching
  translucent pane region.
- Invalid drops and same-pane last-tab edge drops are no-ops.
