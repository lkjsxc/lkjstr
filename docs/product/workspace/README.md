# Workspace Surfaces

## Purpose

Workspace docs define the first screen, tile mechanics, tab list, and flows.

## Table of Contents

- [panes.md](panes.md): pane surface rules.
- [scope.md](scope.md): included and excluded product surface.
- [tabs.md](tabs.md): tab list and opening rules.
- [workflows.md](workflows.md): common user flows.
- [workspace.md](workspace.md): split tile behavior.

## Shared Contract

- Each tile uses a single-row horizontally scrollable tab rail with fade edges
  for overflow and automatic focus reveal.
- Tile headers must not force horizontal document or pane scrolling.
- Active tab content uses the remaining tile height.
- Virtual lists fill their tab body after split resizing.
- Tab drag, drop overlays, and split insertion follow the architecture docs in
  [tab-dragging.md](../../architecture/workspace/tab-dragging.md),
  [pane-chrome-scope.md](../../architecture/workspace/pane-chrome-scope.md),
  and [workspace-layout-tree.md](../../architecture/workspace/workspace-layout-tree.md).
- Feed tab scroll, retention, and list chrome follow
  [tab-retention-flow.md](../../architecture/workspace/tab-retention-flow.md),
  [scroll-layout.md](../../architecture/workspace/scroll-layout.md),
  [tab-shell-layout.md](../../architecture/workspace/tab-shell-layout.md), and
  [feed-scroll-surface.md](../../architecture/data/feed-surface/feed-scroll-surface.md).
