# Workspace Architecture

## Purpose

Workspace architecture docs define layout, tab lifecycle, composition, and
visual rules.

## Table of Contents

- [pane-chrome-scope.md](pane-chrome-scope.md): header chrome vs body rects for
  drag hit testing.
- [pane-drop-target.md](pane-drop-target.md): pane-body edge resolver and
  center insert.
- [tab-body-mount.md](tab-body-mount.md): hidden-mount tab bodies per pane.
- [tab-retention-flow.md](tab-retention-flow.md): blur/focus snapshot pipeline.
- [tab-snapshot-fields.md](tab-snapshot-fields.md): tab-owned snapshot fields,
  restore order, and cleanup.
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
- [ui-system/README.md](ui-system/README.md): shared UI component catalog.
- [ui-system/emoji-palette.md](ui-system/emoji-palette.md): shared emoji picker.
- [ui-system/feed-shell.md](ui-system/feed-shell.md): feed tab scroll shell.
- [ui-system/hybrid-tab-shells.md](ui-system/hybrid-tab-shells.md): hybrid tool
  plus feed tabs.
- [ui-system/identity-surfaces.md](ui-system/identity-surfaces.md): identity
  chips and user rows.
- [ui-system/media-upload-gate.md](ui-system/media-upload-gate.md): upload gate
  hints.
- [ui-system/new-tab-menu.md](ui-system/new-tab-menu.md): flat New Tab grid.
- [ui-system/overflow-actions.md](ui-system/overflow-actions.md): overflow
  menus.
- [ui-system/polish-backlog.md](ui-system/polish-backlog.md): UX polish backlog.
- [ui-system/profile-header-layout.md](ui-system/profile-header-layout.md):
  profile header layout.
- [ui-system/reaction-surfaces.md](ui-system/reaction-surfaces.md): reaction
  picker vs summary.
- [ui-system/scroll-alignment.md](ui-system/scroll-alignment.md): scrollbar
  alignment across tab kinds.
- [ui-system/scroll-inset-ownership.md](ui-system/scroll-inset-ownership.md):
  scroll inset single-owner rules.
- [ui-system/scroll-ownership.md](ui-system/scroll-ownership.md): tab kind to
  scroll root map.
- [ui-system/surface-source-map.md](ui-system/surface-source-map.md): UI source
  map.
- [workspace-layout-tree.md](workspace-layout-tree.md): recursive layout.

## Shared Contract

- Pane bodies and active tab roots own full available height.
- Virtualized lists use the tab body height, not fixed minimum heights.
- Wrapped content must not widen split children.
- Tab movement feedback is shared by pointer and native drag paths.
- Menu splits and drag edge splits use the same smart insertion primitive.
