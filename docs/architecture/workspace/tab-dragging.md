# Tab Dragging

## Purpose

Tab dragging owns tab movement feedback and commits across pointer and native
desktop drag input.

## Documents

- [pane-chrome-scope.md](pane-chrome-scope.md): header chrome vs body rects.
- [tab-strip-gestures.md](tab-strip-gestures.md): touch pan, long-press, capture,
  and selection suppression.
- [pane-drop-target.md](pane-drop-target.md): pane-body edge resolver, center
  insert, and offset edge previews.
- [scroll-layout.md](scroll-layout.md): scrollbar-safe scrolling surfaces.
- [tile-overlays.md](tile-overlays.md): tile-scoped emoji picker placement.

## Contract

- Pointer dragging is canonical for mouse, pen, and touch.
- Native HTML5 drag on fine pointers uses the same drop resolver and overlay
  contract as pointer drag.
- A drag snapshot records source pane id, tab id, pointer id, start point,
  latest point, active state, target pane id, target insertion index, and drop
  zone.
- `setPointerCapture` runs on the tab main control after pointer drag activation.
  Window move, up, and cancel listeners keep the drag reliable when the pointer
  leaves the tab strip.
- `body.dragging-tab` disables text selection on tabs and the document.
- Drag ghosts never block hit testing.
- Pane lookup ignores the ghost and resolves the closest `[data-pane-id]`.
- Drop zones use chrome scope, hit detection, and preview geometry. See
  [pane-drop-target.md](pane-drop-target.md).
- Center drops insert into the target pane tab group using target tab frames.
- Edge drops create a split at the target pane **body** edge using the same smart
  insertion primitive as tile menu splits. See
  [workspace-layout-tree.md](workspace-layout-tree.md).
- Invalid drops and same-pane last-tab edge drops are no-ops.
