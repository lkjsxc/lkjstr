# Workspace Architecture

## Purpose

Workspace architecture docs define layout, tab lifecycle, composition, and
visual rules.

## Documents

- [pane-chrome-scope.md](pane-chrome-scope.md): header chrome vs body rects for
  drag hit testing.
- [pane-drop-target.md](pane-drop-target.md): pane-body edge resolver and
  center insert.
- [tab-body-mount.md](tab-body-mount.md): hidden-mount tab bodies per pane.
- [tab-retention-flow.md](tab-retention-flow.md): blur/focus snapshot pipeline.
- [scroll-layout.md](scroll-layout.md): scrollbar-safe scrolling surfaces.
- [scroll-surface-audit.md](scroll-surface-audit.md): per-surface scroll checklist.
- [tab-shell-layout.md](tab-shell-layout.md): feed-tab vs form-tab scroll
  ownership.
- [tile-overlays.md](tile-overlays.md): tile-scoped emoji picker placement.
- [resize.md](resize.md): split resize math.
- [tab-dragging.md](tab-dragging.md): tab drag overview.
- [tab-runtime.md](tab-runtime.md): tab kinds and lifecycle.
- [tab-strip-gestures.md](tab-strip-gestures.md): rail scroll and drag arming.
- [theme.md](theme.md): visual constraints.
- [tile-menu.md](tile-menu.md): anchored tile commands.
- [ui-composition.md](ui-composition.md): component ownership.
- [workspace-layout-tree.md](workspace-layout-tree.md): recursive layout.

## Shared Contract

- Pane bodies and active tab roots own full available height.
- Virtualized lists use the tab body height, not fixed minimum heights.
- Wrapped content must not widen split children.
- Tab movement feedback is shared by pointer and native drag paths.
- Menu splits and drag edge splits use the same smart insertion primitive.
