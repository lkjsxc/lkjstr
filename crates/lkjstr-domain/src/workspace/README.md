# Workspace Source

## Purpose

Workspace source files define the pure browser-independent model for panes,
tabs, startup layout, focus, opening, splitting, and recovery.

## Table of Contents

- `bootstrap.rs`: deterministic clean-start workspace.
- `commands.rs`: open, focus, split, and close commands.
- `group.rs`: tab group reducers.
- `layout.rs`: pane and split tree helpers.
- `layout_insert.rs`: split insertion helpers for edge drops.
- `mod.rs`: workspace module exports.
- `model.rs`: workspace root and deterministic ID inputs.
- `move_tab.rs`: tab movement reducers.
- `recovery.rs`: usable workspace recovery rules.
- `snapshot.rs`: tab snapshot payloads and merge behavior.
- `snapshot_ops.rs`: snapshot capture, merge, seed, and anchor helpers.
- `tab.rs`: tab kinds, titles, icons, and tab records.
- `tab_catalog.rs`: New Tab option catalog.
