# Workspace Source

## Purpose

Workspace source files define the pure browser-independent model for panes,
tabs, startup layout, focus, opening, splitting, and recovery.

## Table of Contents

- `bootstrap.rs`: deterministic clean-start workspace.
- `commands.rs`: open, focus, split, and close commands.
- `group.rs`: tab group reducers.
- `layout.rs`: pane and split tree helpers.
- `mod.rs`: workspace module exports.
- `model.rs`: workspace root and deterministic ID inputs.
- `recovery.rs`: usable workspace recovery rules.
- `tab.rs`: tab kinds, titles, icons, and tab records.
