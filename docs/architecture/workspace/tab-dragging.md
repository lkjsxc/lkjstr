# Tab Dragging

## Purpose

Tab dragging owns tab movement feedback and commits across pointer and native
desktop drag input.

## Documents

- [tab-strip-gestures.md](tab-strip-gestures.md): touch pan, long-press, and
  strip-priority reorder rules.
- [pane-drop-target.md](pane-drop-target.md): pane-wide resolver, hit corridors,
  and half-pane preview overlays.

## Contract

- Pointer dragging is canonical for mouse, pen, and touch.
- Native HTML5 drag on desktop uses the same drop resolver and overlay contract
  as pointer drag.
- A drag snapshot records source pane id, tab id, pointer id, start point,
  latest point, active state, target pane id, target insertion index, and drop
  zone.
- Pointer capture is requested after drag activation. Window move, up, and
  cancel listeners keep the drag reliable when the pointer leaves the tab strip.
- Drag ghosts never block hit testing.
- Pane lookup ignores the ghost and resolves the closest `[data-pane-id]`.
- Drop zones use separate hit detection and preview geometry. See
  [pane-drop-target.md](pane-drop-target.md).
- Center drops insert into the target pane tab group using target tab frames.
  Pointer and native pane drops share the same insertion index logic.
- Edge drops create a split at the target pane edge using the same smart
  insertion primitive as tile menu splits. See
  [workspace-layout-tree.md](workspace-layout-tree.md).
- Invalid drops and same-pane last-tab edge drops are no-ops.
