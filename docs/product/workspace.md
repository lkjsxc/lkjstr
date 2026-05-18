# Workspace

## Purpose

The workspace is the first screen and owns split tiles.

## Contract

- Tiles contain a tab strip, plus button, and tile menu.
- Plus opens a New Tab chooser in the same tile.
- New Tab conversion preserves the tab id.
- Closing the last tab closes its tile.
- Closing the last tile recovers a timeline tile.
- Tabs move across tiles by drag-and-drop.
- Moving the last tab out of a tile removes the source tile.
- Split actions create recursive layout nodes and persist through the workspace
  store.
- Resize uses a `0.9` pointer sensitivity multiplier and persists in layout.
