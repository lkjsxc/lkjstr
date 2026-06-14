# Workspace Components

## Purpose

This directory contains Svelte components for panes, tabs, splits, and tile
menus.

## Table of Contents

- Workspace root, pane rendering, tab strip, resize handles, and menu controls.
- `WorkspaceRoot` exposes the tab snapshot coordinator through context.
- `Pane` tracks scroll owners and restore tokens through the coordinator instead
  of owning pane-local durable retention.
- `FormTabShell.svelte`: shared non-feed tab root with `.tab-scroll-track`
  track inset and `.tab-scroll-owner` scroll host, matching feed lists.
- `RustIslandHost.svelte`: generic Svelte host glue for Rust/WASM tab bodies.
- `author-context-island.ts`: typed Author Context WASM island mounter.
- `user-timeline-island.ts`: typed User Timeline WASM island mounter.
