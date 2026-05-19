# Panes

## Purpose

Panes are workspace tiles that host tab groups.

## Contract

- Each pane has one tab group.
- The pane header contains tabs, plus, and tile menu.
- Pane content is owned by the active tab kind.
- Pane actions use the clicked pane id, so new tabs and action-opened tabs stay
  in the same tile.
- Pane close removes the pane and recovers the workspace when needed.
- Split actions open a focused New Tab chooser in the new pane.
- Panes accept dragged tabs from their own tab strip or another pane.
- A pane closes when its last tab is moved to another pane.
