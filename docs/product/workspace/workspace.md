# Workspace

## Purpose

The workspace is the first screen and owns split tiles.

## Contract

- Tiles contain a tab strip, plus button, and tile menu.
- Plus opens a New Tab chooser in the same tile.
- New Tab conversion preserves the tab id.
- Closing the last tab closes its tile.
- Closing the last tile recovers a Welcome tile.
- Tabs move across tiles by drag-and-drop.
- Moving the last tab out of a tile removes the source tile.
- Split actions create recursive layout nodes and persist through the SQLite
  workspace store when browser Workers are available.
- Resize uses a `1.8` pointer sensitivity multiplier and persists in layout.
- Startup focuses Welcome and also creates Accounts, Relay Settings, Home,
  Notifications, and Tweet before async storage finishes. Invalid, blocked, or
  corrupt storage recovers to a usable Welcome workspace.
- The application header source link opens GitHub in a new browsing context
  with `noopener noreferrer`.
