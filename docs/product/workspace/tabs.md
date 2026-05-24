# Tabs

## Purpose

Tabs define the workspace surface area.

## New Tab Choices

- Home
- Tweet
- Notifications
- Search
- Custom Request
- Global
- Profile Edit
- Accounts
- Relay Settings
- Stats
- Settings
- Upload Settings
- lkjstr Log
- Mine npub
- Welcome

## Action-Opened Tabs

- Welcome is the clean first-launch tab in the top startup pane and can also be
  opened from New Tab.
- Welcome gives quick-start status for accounts, relays, Home, Notifications,
  Search, Tweet, and the core workspace surfaces.
- Profile opens from identity buttons in timelines and profile-related UI.
- Profile actions focus a matching Profile tab already present in the same
  tile; otherwise they open a new Profile tab in that tile.
- Profile Edit opens from the active account profile action. The tab focuses an
  existing Profile Edit tab in the same tile before creating one.
- Profile Edit always edits the current active signing account.
- Upload Settings opens from New Tab and edits the shared Tweet media upload
  provider records.
- Thread opens from event rows, event id buttons, quotes, compact reference
  cards, notification event bodies, fallback notification context, and
  collapsed continuation rows.
- Thread actions focus a matching Thread tab already present in the same tile;
  otherwise they open a new Thread tab in that tile.
- Author Context opens from an event row menu and loads the anchor plus nearby
  authored events in the same tile.
- Custom Request opens from New Tab, validates JSON relay filters, and renders
  real relay results with the shared event row surface.
- Mine npub owns vanity key generation. Accounts can add exported results only
  after explicit user action.
- Stats is a workspace tab kind named `network-stats`.
- Search runs local cached content matches and relay NIP-50 search filters.
- Tweet clears immediately after signed local queueing. Notifications show
  lightweight action context headers and render source notification events with
  canonical Timeline row behavior; target/root context is fallback-only.

## Movement

- Tabs can be dragged to reorder within a tile with pointer dragging or native
  desktop drag-and-drop.
- Tabs can be dragged into another tile, or to a tile edge to split there.
- Pane drop feedback shows a translucent full-pane center region or a matching
  left, right, top, or bottom edge region.
- Moving a tab activates and focuses it in the target tile.
- Moving the last tab out of a tile closes the source tile.
- Invalid drops do nothing.

## Fit

- The tab strip wraps or compresses tab titles inside the tile width.
- Tab text may truncate, but pane content must not create horizontal scrolling.
- Tab bodies fill the pane body height and keep scroll ownership local.
- Inactive tab bodies unmount when focus changes. Within
  `tabs.inactiveRetentionSeconds`, the workspace keeps a bounded session-memory
  UI snapshot so scroll and local view state can restore when the tab is
  selected again.

## Removed Surface

There is no retired draft-planning workspace tab. Profile and Thread are opened
from actions rather than free-form New Tab inputs.
