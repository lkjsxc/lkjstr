# Workspace Architecture

## Purpose

Workspace architecture docs define layout, tab lifecycle, composition, and
visual rules.

## Documents

- [resize.md](resize.md): split resize math.
- [tab-dragging.md](tab-dragging.md): tab drag zones and feedback.
- [tab-runtime.md](tab-runtime.md): tab kinds and lifecycle.
- [theme.md](theme.md): visual constraints.
- [tile-menu.md](tile-menu.md): anchored tile commands.
- [ui-composition.md](ui-composition.md): component ownership.
- [workspace-layout-tree.md](workspace-layout-tree.md): recursive layout.

## Shared Contract

- Pane bodies and active tab roots own full available height.
- Virtualized lists use the tab body height, not fixed minimum heights.
- Wrapped content must not widen split children.
- Tab movement feedback is shared by pointer and native drag paths.
